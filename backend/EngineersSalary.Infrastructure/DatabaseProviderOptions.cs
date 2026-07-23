namespace EngineersSalary.Infrastructure;

public sealed class DatabaseProviderOptions
{
    public const string SectionName = "Database";
    public const string SqlServer = "SqlServer";
    public const string PostgreSql = "PostgreSQL";

    public string Provider { get; init; } = SqlServer;
}
