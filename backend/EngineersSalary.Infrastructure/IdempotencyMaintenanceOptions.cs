namespace EngineersSalary.Infrastructure;

public sealed class IdempotencyMaintenanceOptions
{
    public const string SectionName = "IdempotencyMaintenance";

    public bool Enabled { get; init; } = true;
    public int RetentionDays { get; init; } = 30;
    public int IntervalHours { get; init; } = 24;
}
