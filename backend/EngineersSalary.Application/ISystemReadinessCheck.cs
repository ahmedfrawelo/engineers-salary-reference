namespace EngineersSalary.Application;

public interface ISystemReadinessCheck
{
    Task<SystemReadinessResult> CheckAsync(CancellationToken cancellationToken);
}

public sealed record SystemReadinessResult(
    bool IsReady,
    string DatabaseStatus,
    long DatabaseLatencyMilliseconds,
    string? FailureReason = null);
