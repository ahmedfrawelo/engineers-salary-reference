namespace EngineersSalary.Infrastructure;

public sealed class GoogleSheetSalaryImportOptions
{
    public const string SectionName = "GoogleSheetSalaryImport";

    public bool Enabled { get; init; }
    public string WorkbookPath { get; init; } = string.Empty;
    public string WorkbookUrl { get; init; } = string.Empty;
    public int IntervalMinutes { get; init; } = 60;
    public string SourceName { get; init; } = "google-drive-salary-sheet";
    public long MaxDownloadBytes { get; init; } = 25 * 1024 * 1024;
    public int DownloadTimeoutSeconds { get; init; } = 30;
    public int MaxRowsPerImport { get; init; } = 100_000;
}
