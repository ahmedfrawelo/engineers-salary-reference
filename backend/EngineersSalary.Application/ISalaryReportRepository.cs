using EngineersSalary.Domain;

namespace EngineersSalary.Application;

public interface ISalaryReportRepository
{
    Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> ListReferenceOptionsAsync(CancellationToken cancellationToken);

    Task<SalaryNumericOptions> ListNumericOptionsAsync(CancellationToken cancellationToken);

    Task<SalaryReport?> GetPublishedByIdAsync(Guid id, CancellationToken cancellationToken);

    Task<SalaryReportIdempotentCreateResult> CreateIdempotentAsync(
        SalaryReport report,
        string idempotencyKey,
        string requestHash,
        CancellationToken cancellationToken);
}

public sealed record SalaryReportIdempotentCreateResult(SalaryReport Report, bool Created);

public sealed record SalaryNumericOptions(
    IReadOnlyList<decimal> MonthlyNetSalaries,
    IReadOnlyList<int> YearsOfExperience,
    IReadOnlyList<decimal> DailyWorkHours);

public sealed class IdempotencyConflictException(string message) : Exception(message);
