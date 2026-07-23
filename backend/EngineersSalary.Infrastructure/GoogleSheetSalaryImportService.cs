using System.Security.Cryptography;
using System.Text;
using System.Globalization;
using EngineersSalary.Application;
using EngineersSalary.Domain;
using ExcelDataReader;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EngineersSalary.Infrastructure;

internal sealed class GoogleSheetSalaryImportService(
    EngineersSalaryDbContext dbContext,
    IOptions<GoogleSheetSalaryImportOptions> options,
    IHttpClientFactory httpClientFactory,
    ISalaryReportChangeNotifier? changeNotifier = null) : IGoogleSheetSalaryImportService
{
    public async Task<GoogleSheetSalaryImportResult> SynchronizeAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
        await using var stream = await OpenWorkbookAsync(settings, cancellationToken);
        using var reader = ExcelReaderFactory.CreateReader(stream);

        var skipped = 0;
        var headerSeen = false;
        var processedRows = 0;
        var candidates = new Dictionary<string, ImportedSalaryCandidate>(StringComparer.Ordinal);

        while (reader.Read())
        {
            processedRows++;
            if (processedRows > Math.Clamp(settings.MaxRowsPerImport, 1_000, 500_000))
            {
                throw new InvalidDataException("The salary workbook exceeds the configured row limit.");
            }
            var values = Enumerable.Range(0, reader.FieldCount)
                .Select(index => reader.IsDBNull(index) ? string.Empty : Convert.ToString(reader.GetValue(index))?.Trim() ?? string.Empty)
                .ToArray();

            if (!headerSeen)
            {
                headerSeen = values.Any(value => value.Contains("Country", StringComparison.OrdinalIgnoreCase))
                    || values.Any(value => value.Contains("الدولة", StringComparison.Ordinal));
                continue;
            }

            if (!TryMap(values, out var row))
            {
                skipped++;
                continue;
            }

            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\u001F', values))));
            candidates[row.ExternalId] = new ImportedSalaryCandidate(row, hash);
        }

        var executionStrategy = dbContext.Database.CreateExecutionStrategy();
        var result = await executionStrategy.ExecuteAsync(async () =>
        {
            dbContext.ChangeTracker.Clear();
            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            await SqlServerSynchronizationLock.AcquireAsync(
                dbContext,
                settings.SourceName,
                cancellationToken);
            var created = 0;
            var updated = 0;
            var unchanged = 0;
            var existingSources = await dbContext.SalaryReportSourceRecords
                .Where(source => source.SourceName == settings.SourceName)
                .ToDictionaryAsync(source => source.ExternalRowId, StringComparer.Ordinal, cancellationToken);
            var pendingUpdates = new List<(SalaryReportSourceRecord Source, ImportedSalaryCandidate Candidate)>();

            foreach (var candidate in candidates.Values)
            {
                var row = candidate.Row;
                if (!existingSources.TryGetValue(row.ExternalId, out var source))
                {
                    var report = row.ToSalaryReport();
                    await dbContext.SalaryReports.AddAsync(report, cancellationToken);
                    var newSource = new SalaryReportSourceRecord(
                        report.Id,
                        settings.SourceName,
                        row.ExternalId,
                        candidate.ContentHash);
                    await dbContext.SalaryReportSourceRecords.AddAsync(newSource, cancellationToken);
                    existingSources[row.ExternalId] = newSource;
                    created++;
                    continue;
                }

                if (source.ContentHash == candidate.ContentHash)
                {
                    unchanged++;
                    continue;
                }

                pendingUpdates.Add((source, candidate));
            }

            if (pendingUpdates.Count > 0)
            {
                var reportIds = pendingUpdates.Select(item => item.Source.SalaryReportId).ToArray();
                var reportsById = await dbContext.SalaryReports
                    .Where(report => reportIds.Contains(report.Id))
                    .ToDictionaryAsync(report => report.Id, cancellationToken);

                foreach (var (source, candidate) in pendingUpdates)
                {
                    var row = candidate.Row;
                    var report = reportsById[source.SalaryReportId];
                    report.RefreshImportedValues(
                    row.Discipline, row.CompanyType, row.City, row.Country, row.MonthlyNetSalary, row.Currency,
                    row.YearsOfExperience, row.WorkMode, row.Benefits, row.HousingProvided, row.TransportationProvided,
                    row.AnnualBonus, row.SalaryFairness, row.RecommendField, row.NegotiationAdvice,
                    row.ProfessionalCertificate, row.HighestEducation, row.DailyWorkHours, row.ExtraDayOff);
                    source.MarkSynchronized(candidate.ContentHash);
                    updated++;
                }
            }

            if (created + updated > 0)
            {
                await dbContext.SaveChangesAsync(cancellationToken);
                await SalaryReportReferenceSynchronizer.SynchronizeAsync(dbContext, cancellationToken);
            }
            await transaction.CommitAsync(cancellationToken);
            return new GoogleSheetSalaryImportResult(created, updated, unchanged, skipped);
        });

        if (changeNotifier is not null && result.Created + result.Updated > 0)
        {
            await changeNotifier.PublishAsync(
                new SalaryReportChangeNotification(
                    "synchronized",
                    result.Created + result.Updated,
                    DateTimeOffset.UtcNow),
                CancellationToken.None);
        }
        return result;
    }

    private async Task<Stream> OpenWorkbookAsync(GoogleSheetSalaryImportOptions settings, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(settings.WorkbookUrl))
        {
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(settings.DownloadTimeoutSeconds, 5, 120)));
                using var request = new HttpRequestMessage(HttpMethod.Get, settings.WorkbookUrl);
                using var response = await httpClientFactory.CreateClient("GoogleDriveSalaryImport")
                    .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                response.EnsureSuccessStatusCode();
                var maxBytes = Math.Clamp(settings.MaxDownloadBytes, 1024 * 1024, 100L * 1024 * 1024);
                if (response.Content.Headers.ContentLength is > 0 && response.Content.Headers.ContentLength > maxBytes)
                {
                    throw new InvalidDataException("The remote salary workbook exceeds the configured download limit.");
                }

                var memory = new MemoryStream();
                await using var responseStream = await response.Content.ReadAsStreamAsync(timeout.Token);
                await CopyWithLimitAsync(responseStream, memory, maxBytes, timeout.Token);
                memory.Position = 0;
                return memory;
            }
            catch (HttpRequestException) when (!string.IsNullOrWhiteSpace(settings.WorkbookPath) && File.Exists(settings.WorkbookPath))
            {
                // Development fallback keeps scheduled imports available when Drive requires browser authentication.
            }
            catch (OperationCanceledException) when (
                !cancellationToken.IsCancellationRequested &&
                !string.IsNullOrWhiteSpace(settings.WorkbookPath) &&
                File.Exists(settings.WorkbookPath))
            {
                // A bounded remote timeout may use the configured local workbook fallback.
            }
        }

        if (string.IsNullOrWhiteSpace(settings.WorkbookPath) || !File.Exists(settings.WorkbookPath))
        {
            throw new FileNotFoundException("Configured Google Drive salary workbook was not found.", settings.WorkbookPath);
        }
        var localFile = new FileInfo(settings.WorkbookPath);
        var localMaxBytes = Math.Clamp(settings.MaxDownloadBytes, 1024 * 1024, 100L * 1024 * 1024);
        if (localFile.Length > localMaxBytes)
        {
            throw new InvalidDataException("The local salary workbook exceeds the configured file-size limit.");
        }
        return File.Open(settings.WorkbookPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
    }

    private static async Task CopyWithLimitAsync(
        Stream source,
        Stream destination,
        long maxBytes,
        CancellationToken cancellationToken)
    {
        var buffer = new byte[64 * 1024];
        long totalBytes = 0;
        while (true)
        {
            var bytesRead = await source.ReadAsync(buffer, cancellationToken);
            if (bytesRead == 0) break;
            totalBytes += bytesRead;
            if (totalBytes > maxBytes)
            {
                throw new InvalidDataException("The remote salary workbook exceeds the configured download limit.");
            }
            await destination.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
        }
    }

    private static bool TryMap(IReadOnlyList<string> row, out ImportedSalaryRow mapped)
    {
        mapped = default!;
        // The worksheet starts with its response identifier; form answers run from country at index 1
        // through additional day off at index 19. Keep this aligned with the supplied workbook, not a UI column order.
        if (row.Count < 20 ||
            !TryParseNumber(row[8].Replace(",", string.Empty), out var salary) ||
            salary is <= 0 or > 10_000_000)
        {
            return false;
        }

        var externalId = Required(row[0]);
        var discipline = Required(row[3]);
        if (externalId is null || discipline is null)
        {
            return false;
        }

        var yearsOfExperience = ParseInt(Value(row, 4));
        var dailyWorkHours = ParseDecimal(Value(row, 18));
        if (yearsOfExperience is < 0 or > 60 || dailyWorkHours is < 0 or > 24)
        {
            return false;
        }

        mapped = new ImportedSalaryRow(
            externalId, Value(row, 1) ?? "Not specified", Value(row, 2) ?? "Not specified", discipline,
            yearsOfExperience, Value(row, 5) ?? "Not specified", Value(row, 6) ?? "Not specified",
            NormalizeCurrency(Value(row, 7)), salary, Value(row, 9), Value(row, 10), Value(row, 11),
            Value(row, 12), Value(row, 13), Value(row, 14), Value(row, 15), Value(row, 16), Value(row, 17),
            dailyWorkHours, Value(row, 19));
        return IsWithinPersistenceLimits(mapped);
    }

    private static string? Value(IReadOnlyList<string> row, int index) => index < row.Count && !string.IsNullOrWhiteSpace(row[index]) ? row[index].Trim() : null;
    private static string? Required(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static int ParseInt(string? value) => int.TryParse(
        value,
        NumberStyles.Integer,
        CultureInfo.InvariantCulture,
        out var parsed) ? parsed : 0;
    private static decimal? ParseDecimal(string? value) => TryParseNumber(value, out var parsed) ? parsed : null;
    private static bool TryParseNumber(string? value, out decimal parsed) => decimal.TryParse(
        value,
        NumberStyles.Number,
        CultureInfo.InvariantCulture,
        out parsed);
    private static string NormalizeCurrency(string? value) => (value ?? "EGP").Trim().ToUpperInvariant() switch { "جنيه مصري" => "EGP", "ريال سعودي" => "SAR", "درهم" => "AED", "دينار كويتي" => "KWD", var currency => currency.Length <= 8 ? currency : currency[..8] };

    private static bool IsWithinPersistenceLimits(ImportedSalaryRow row) =>
        Fits(row.Country, 100) &&
        Fits(row.City, 100) &&
        Fits(row.Discipline, 120) &&
        Fits(row.CompanyType, 120) &&
        Fits(row.WorkMode, 80) &&
        Fits(row.Currency, 8) &&
        Fits(row.HousingProvided, 80) &&
        Fits(row.TransportationProvided, 80) &&
        Fits(row.AnnualBonus, 80) &&
        Fits(row.SalaryFairness, 80) &&
        Fits(row.RecommendField, 80) &&
        Fits(row.NegotiationAdvice, 1_000) &&
        Fits(row.ProfessionalCertificate, 120) &&
        Fits(row.Benefits, 600) &&
        Fits(row.HighestEducation, 120) &&
        Fits(row.ExtraDayOff, 80);

    private static bool Fits(string? value, int maximumLength) => value is null || value.Length <= maximumLength;

    private sealed record ImportedSalaryRow(string ExternalId, string Country, string City, string Discipline, int YearsOfExperience, string CompanyType, string WorkMode, string Currency, decimal MonthlyNetSalary, string? HousingProvided, string? TransportationProvided, string? AnnualBonus, string? SalaryFairness, string? RecommendField, string? NegotiationAdvice, string? ProfessionalCertificate, string? Benefits, string? HighestEducation, decimal? DailyWorkHours, string? ExtraDayOff)
    {
        public SalaryReport ToSalaryReport() => new(
            Country, City, Discipline, YearsOfExperience, CompanyType, WorkMode, Currency,
            MonthlyNetSalary, DateOnly.FromDateTime(DateTime.UtcNow), HousingProvided,
            TransportationProvided, AnnualBonus, SalaryFairness, RecommendField,
            NegotiationAdvice, ProfessionalCertificate, Benefits, HighestEducation,
            DailyWorkHours, ExtraDayOff);
    }

    private sealed record ImportedSalaryCandidate(ImportedSalaryRow Row, string ContentHash);
}
