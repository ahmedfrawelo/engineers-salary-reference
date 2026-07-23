using System.Diagnostics;
using EngineersSalary.Application;
using Microsoft.EntityFrameworkCore;

namespace EngineersSalary.Infrastructure;

internal sealed class DatabaseReadinessCheck(EngineersSalaryDbContext dbContext) : ISystemReadinessCheck
{
    public async Task<SystemReadinessResult> CheckAsync(CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            var connected = await dbContext.Database.CanConnectAsync(cancellationToken);
            stopwatch.Stop();

            return new SystemReadinessResult(
                connected,
                connected ? "Connected" : "Unavailable",
                stopwatch.ElapsedMilliseconds,
                connected ? null : "The salary database is unavailable.");
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            stopwatch.Stop();
            return new SystemReadinessResult(
                false,
                "Unavailable",
                stopwatch.ElapsedMilliseconds,
                "The salary database is unavailable.");
        }
    }
}
