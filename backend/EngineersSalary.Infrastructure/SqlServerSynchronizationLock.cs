using System.Data;
using EngineersSalary.Application;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EngineersSalary.Infrastructure;

// Kept under its existing name because callers and SQL Server integration tests use it,
// but the lock is provider-aware: production can run on either SQL Server or PostgreSQL.
internal static class SqlServerSynchronizationLock
{
    public static async Task AcquireAsync(
        EngineersSalaryDbContext dbContext,
        string sourceName,
        CancellationToken cancellationToken)
    {
        var transaction = dbContext.Database.CurrentTransaction
            ?? throw new InvalidOperationException("A database transaction is required before acquiring the synchronization lock.");
        await using var command = dbContext.Database.GetDbConnection().CreateCommand();
        command.Transaction = transaction.GetDbTransaction();
        command.CommandType = CommandType.Text;
        var isPostgreSql = string.Equals(
            dbContext.Database.ProviderName,
            "Npgsql.EntityFrameworkCore.PostgreSQL",
            StringComparison.Ordinal);
        command.CommandText = isPostgreSql
            ? "SELECT pg_try_advisory_xact_lock(hashtextextended(@resource, 0));"
            : """
                DECLARE @result int;
                EXEC @result = sys.sp_getapplock
                    @Resource = @resource,
                    @LockMode = 'Exclusive',
                    @LockOwner = 'Transaction',
                    @LockTimeout = 0;
                SELECT @result;
                """;
        var resource = command.CreateParameter();
        resource.ParameterName = "@resource";
        resource.Value = $"EngineersSalary:SourceSync:{sourceName.Trim()}";
        command.Parameters.Add(resource);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        var acquired = isPostgreSql
            ? Convert.ToBoolean(result)
            : Convert.ToInt32(result) >= 0;
        if (!acquired)
        {
            throw new SourceSynchronizationInProgressException(
                "Another source synchronization is already in progress.");
        }
    }
}
