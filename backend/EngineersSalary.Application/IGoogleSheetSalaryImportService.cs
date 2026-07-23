namespace EngineersSalary.Application;

public interface IGoogleSheetSalaryImportService
{
    Task<GoogleSheetSalaryImportResult> SynchronizeAsync(CancellationToken cancellationToken);
}

public sealed record GoogleSheetSalaryImportResult(int Created, int Updated, int Unchanged, int Skipped);

public sealed class SourceSynchronizationInProgressException(string message) : Exception(message);
