namespace EngineersSalary.Domain;

public sealed class SalarySubmissionIdempotencyRecord
{
    private SalarySubmissionIdempotencyRecord() { }

    public SalarySubmissionIdempotencyRecord(
        string key,
        string requestHash,
        Guid salaryReportId,
        DateTimeOffset createdAt)
    {
        Key = key;
        RequestHash = requestHash;
        SalaryReportId = salaryReportId;
        CreatedAt = createdAt;
    }

    public string Key { get; private set; } = string.Empty;
    public string RequestHash { get; private set; } = string.Empty;
    public Guid SalaryReportId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public SalaryReport SalaryReport { get; private set; } = null!;
}
