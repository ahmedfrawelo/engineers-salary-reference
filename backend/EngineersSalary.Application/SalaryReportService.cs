using EngineersSalary.Contracts;
using EngineersSalary.Domain;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EngineersSalary.Application;

public sealed class SalaryReportService(
    ISalaryReportRepository repository,
    ISalaryReportChangeNotifier? changeNotifier = null)
{
    private static readonly SalaryOptionsDto FallbackOptions = new(
        ["Civil", "Architecture", "Mechanical", "Electrical", "Software", "Planning", "Cost Control", "Site"],
        ["Contractor", "Consultant", "Developer", "Industrial", "Technology", "Government"],
        [],
        ["Egypt", "Saudi Arabia", "United Arab Emirates", "Kuwait", "Qatar"],
        ["Site", "Office", "Hybrid", "Remote"],
        ["EGP", "SAR", "AED", "KWD", "QAR", "OMR", "USD", "EUR"],
        ["Yes", "No"],
        ["Yes", "No"],
        ["Yes", "No"],
        ["Yes", "No", "Maybe"],
        ["Yes", "No", "Maybe"],
        [],
        [],
        [],
        [],
        [],
        []);

    public async Task<SalaryReportDto?> GetPublishedByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var report = await repository.GetPublishedByIdAsync(id, cancellationToken);
        return report?.ToDto();
    }

    public async Task<SalaryReportCreationResult> CreateIdempotentAsync(
        CreateSalaryReportRequest request,
        string idempotencyKey,
        CancellationToken cancellationToken)
    {
        var normalizedRequest = SalaryReportRequestNormalizer.Normalize(request);
        var report = BuildReport(normalizedRequest);
        var requestJson = JsonSerializer.Serialize(normalizedRequest);
        var requestHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(requestJson)));
        var result = await repository.CreateIdempotentAsync(
            report,
            idempotencyKey,
            requestHash,
            cancellationToken);
        if (result.Created) await NotifyCreatedAsync();
        return new SalaryReportCreationResult(result.Report.ToDto(), result.Created);
    }

    public async Task<SalaryOptionsDto> GetOptionsAsync(CancellationToken cancellationToken)
    {
        var referenceOptions = await repository.ListReferenceOptionsAsync(cancellationToken);
        var numericOptions = await repository.ListNumericOptionsAsync(cancellationToken);
        if (referenceOptions.Count > 0)
        {
            return new SalaryOptionsDto(
                FromCatalog(referenceOptions, "discipline", FallbackOptions.Disciplines),
                FromCatalog(referenceOptions, "company-type", FallbackOptions.CompanyTypes),
                FromCatalog(referenceOptions, "city", FallbackOptions.Cities),
                FromCatalog(referenceOptions, "country", FallbackOptions.Countries),
                FromCatalog(referenceOptions, "work-mode", FallbackOptions.WorkModes),
                FromCatalog(referenceOptions, "currency", FallbackOptions.Currencies),
                FromCatalog(referenceOptions, "housing", FallbackOptions.HousingProvided),
                FromCatalog(referenceOptions, "transportation", FallbackOptions.TransportationProvided),
                FromCatalog(referenceOptions, "annual-bonus", FallbackOptions.AnnualBonuses),
                FromCatalog(referenceOptions, "salary-fairness", FallbackOptions.SalaryFairnessOptions),
                FromCatalog(referenceOptions, "recommend-field", FallbackOptions.RecommendFieldOptions),
                FromCatalog(referenceOptions, "certificate", FallbackOptions.ProfessionalCertificates),
                FromCatalog(referenceOptions, "education", FallbackOptions.HighestEducations),
                FromCatalog(referenceOptions, "extra-day-off", FallbackOptions.ExtraDaysOff),
                numericOptions.MonthlyNetSalaries,
                numericOptions.YearsOfExperience,
                numericOptions.DailyWorkHours);
        }

        return FallbackOptions with
        {
            MonthlyNetSalaries = numericOptions.MonthlyNetSalaries,
            YearsOfExperience = numericOptions.YearsOfExperience,
            DailyWorkHours = numericOptions.DailyWorkHours,
        };
    }

    private static IReadOnlyList<string> FromCatalog(IReadOnlyDictionary<string, IReadOnlyList<string>> options, string code, IReadOnlyList<string> fallback)
        => options.TryGetValue(code, out var values) && values.Count > 0 ? values : fallback;

    private static SalaryReport BuildReport(CreateSalaryReportRequest request) => new(
        request.Country,
        request.City,
        request.Discipline,
        request.YearsOfExperience,
        request.CompanyType,
        request.WorkMode,
        request.Currency,
        request.MonthlyNetSalary,
        DateOnly.FromDateTime(DateTime.UtcNow),
        request.HousingProvided,
        request.TransportationProvided,
        request.AnnualBonus,
        request.SalaryFairness,
        request.RecommendField,
        request.NegotiationAdvice,
        request.ProfessionalCertificate,
        request.Benefits,
        request.HighestEducation,
        request.DailyWorkHours,
        request.ExtraDayOff);

    private async Task NotifyCreatedAsync()
    {
        if (changeNotifier is null) return;
        await changeNotifier.PublishAsync(
            new SalaryReportChangeNotification("created", 1, DateTimeOffset.UtcNow),
            CancellationToken.None);
    }
}

public sealed record SalaryReportCreationResult(SalaryReportDto Report, bool Created);
