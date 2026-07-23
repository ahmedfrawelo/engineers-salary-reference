namespace EngineersSalary.Domain;

public sealed class SalaryReportSourceRecord
{
    private SalaryReportSourceRecord()
    {
    }

    public SalaryReportSourceRecord(Guid salaryReportId, string sourceName, string externalRowId, string contentHash)
    {
        Id = Guid.NewGuid();
        SalaryReportId = salaryReportId;
        SourceName = sourceName.Trim();
        ExternalRowId = externalRowId.Trim();
        ContentHash = contentHash;
        SynchronizedAt = DateTimeOffset.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid SalaryReportId { get; private set; }
    public SalaryReport SalaryReport { get; private set; } = null!;
    public string SourceName { get; private set; } = string.Empty;
    public string ExternalRowId { get; private set; } = string.Empty;
    public string ContentHash { get; private set; } = string.Empty;
    public DateTimeOffset SynchronizedAt { get; private set; }

    public void MarkSynchronized(string contentHash)
    {
        ContentHash = contentHash;
        SynchronizedAt = DateTimeOffset.UtcNow;
    }
}
