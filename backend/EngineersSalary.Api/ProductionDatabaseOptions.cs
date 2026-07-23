using Microsoft.Data.SqlClient;
using Npgsql;

public sealed class ProductionDatabaseOptions
{
    public string DefaultConnection { get; init; } = string.Empty;

    public static bool IsSecure(string value, string provider)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (string.Equals(provider, "PostgreSQL", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var connection = new NpgsqlConnectionStringBuilder(value);
                return connection.SslMode == SslMode.Require
                    && connection.Timeout is > 0 and <= 30
                    && connection.MaxPoolSize is > 0 and <= 100;
            }
            catch (ArgumentException)
            {
                return false;
            }
        }

        try
        {
            var connection = new SqlConnectionStringBuilder(value);
            return connection.Encrypt != SqlConnectionEncryptOption.Optional
                && !connection.TrustServerCertificate
                && connection.MinPoolSize == 0
                && connection.MaxPoolSize is > 0 and <= 100;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }
}

public sealed class ProductionSecretOptions
{
    public HealthSecretOptions Health { get; init; } = new();
    public SourceSynchronizationSecretOptions GoogleSheetSalaryImport { get; init; } = new();
}

public sealed class HealthSecretOptions
{
    public string DiagnosticKey { get; init; } = string.Empty;
}

public sealed class SourceSynchronizationSecretOptions
{
    public string SynchronizationKey { get; init; } = string.Empty;
}
