using EngineersSalary.Application;
using EngineersSalary.Contracts;
using EngineersSalary.Domain;

namespace EngineersSalary.Tests;

public sealed class SalaryReportServiceTests
{
    [Fact]
    public void Repository_exposes_only_the_idempotent_creation_path()
    {
        var writeMethods = typeof(ISalaryReportRepository)
            .GetMethods()
            .Where(method => method.Name.Contains("Create", StringComparison.Ordinal) ||
                             method.Name.Contains("Add", StringComparison.Ordinal))
            .Select(method => method.Name)
            .ToArray();

        Assert.Equal([nameof(ISalaryReportRepository.CreateIdempotentAsync)], writeMethods);
    }

    [Fact]
    public async Task GetPublishedByIdAsync_returns_matching_report()
    {
        var source = Report("Civil Engineering", "Junior", 10_000);
        var repository = new InMemorySalaryReportRepository(source);
        var service = new SalaryReportService(repository);

        var report = await service.GetPublishedByIdAsync(source.Id, CancellationToken.None);

        Assert.NotNull(report);
        Assert.Equal(source.Id, report.Id);
    }

    [Fact]
    public async Task GetOptionsAsync_uses_projected_numeric_options_without_loading_reports()
    {
        var repository = new InMemorySalaryReportRepository(Report("Mechanical", "Senior", 25_000))
        {
            ReferenceOptions = new Dictionary<string, IReadOnlyList<string>>
            {
                ["discipline"] = ["Mechanical"]
            }
        };
        var service = new SalaryReportService(repository);

        var options = await service.GetOptionsAsync(CancellationToken.None);

        Assert.Equal([25_000m], options.MonthlyNetSalaries);
    }

    [Fact]
    public async Task CreateIdempotentAsync_hashes_the_normalized_request()
    {
        var repository = new InMemorySalaryReportRepository();
        var service = new SalaryReportService(repository);
        var request = ContributionRequest();

        var first = await service.CreateIdempotentAsync(request, "normalization-key-0001", CancellationToken.None);
        var second = await service.CreateIdempotentAsync(
            request with { Discipline = "  Mechanical  ", Currency = "egp", NegotiationAdvice = "  useful advice  " },
            "normalization-key-0002",
            CancellationToken.None);

        Assert.Equal(repository.RequestHashes[0], repository.RequestHashes[1]);
        Assert.Equal("Mechanical", first.Report.Discipline);
        Assert.Equal("EGP", second.Report.Currency);
        Assert.Equal("useful advice", second.Report.NegotiationAdvice);
    }

    private static SalaryReport Report(string discipline, string seniority, decimal salary)
    {
        return new SalaryReport(
            "Egypt",
            "Cairo",
            discipline,
            3,
            "Consultant",
            "Hybrid",
            "EGP",
            salary,
            DateOnly.FromDateTime(DateTime.UtcNow),
            null);
    }

    private static CreateSalaryReportRequest ContributionRequest() => new(
        "Egypt", "Cairo", "Mechanical", 5, "Consultant", "Hybrid", "EGP", 30_000,
        null, null, null, null, null, "useful advice", null, null, null, 8, null);

    private sealed class InMemorySalaryReportRepository(params SalaryReport[] reports) : ISalaryReportRepository
    {
        private readonly List<SalaryReport> reports = reports.ToList();
        public List<string> RequestHashes { get; } = [];
        public IReadOnlyDictionary<string, IReadOnlyList<string>> ReferenceOptions { get; init; }
            = new Dictionary<string, IReadOnlyList<string>>();

        public Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> ListReferenceOptionsAsync(CancellationToken cancellationToken)
            => Task.FromResult(ReferenceOptions);

        public Task<SalaryNumericOptions> ListNumericOptionsAsync(CancellationToken cancellationToken)
            => Task.FromResult(new SalaryNumericOptions(
                reports.Select(report => report.MonthlyNetSalary).Distinct().Order().ToArray(),
                reports.Select(report => report.YearsOfExperience).Distinct().Order().ToArray(),
                reports.Where(report => report.DailyWorkHours.HasValue).Select(report => report.DailyWorkHours!.Value).Distinct().Order().ToArray()));

        public Task<SalaryReport?> GetPublishedByIdAsync(Guid id, CancellationToken cancellationToken)
        {
            return Task.FromResult(reports.FirstOrDefault(report => report.Id == id && report.Status == SalaryReportStatus.Published));
        }

        public Task<SalaryReportIdempotentCreateResult> CreateIdempotentAsync(
            SalaryReport report,
            string idempotencyKey,
            string requestHash,
            CancellationToken cancellationToken)
        {
            RequestHashes.Add(requestHash);
            reports.Add(report);
            return Task.FromResult(new SalaryReportIdempotentCreateResult(report, true));
        }
    }

}
