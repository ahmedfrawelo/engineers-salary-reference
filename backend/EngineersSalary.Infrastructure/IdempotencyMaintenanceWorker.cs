using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EngineersSalary.Infrastructure;

internal sealed class IdempotencyMaintenanceWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<IdempotencyMaintenanceOptions> options,
    ILogger<IdempotencyMaintenanceWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (!settings.Enabled) return;

        var retention = TimeSpan.FromDays(Math.Clamp(settings.RetentionDays, 7, 365));
        var interval = TimeSpan.FromHours(Math.Clamp(settings.IntervalHours, 1, 168));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<EngineersSalaryDbContext>();
                var cutoff = DateTimeOffset.UtcNow - retention;
                var deleted = await dbContext.SalarySubmissionIdempotencyRecords
                    .Where(record => record.CreatedAt < cutoff)
                    .ExecuteDeleteAsync(stoppingToken);
                if (deleted > 0)
                {
                    logger.LogInformation("Removed {Count} expired salary idempotency records.", deleted);
                }
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(exception, "Salary idempotency maintenance failed.");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }
}
