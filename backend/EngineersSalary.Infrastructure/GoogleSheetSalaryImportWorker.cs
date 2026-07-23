using EngineersSalary.Application;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EngineersSalary.Infrastructure;

internal sealed class GoogleSheetSalaryImportWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<GoogleSheetSalaryImportOptions> options,
    ILogger<GoogleSheetSalaryImportWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (!settings.Enabled) return;
        var interval = TimeSpan.FromMinutes(Math.Clamp(settings.IntervalMinutes, 15, 1440));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IGoogleSheetSalaryImportService>().SynchronizeAsync(stoppingToken);
            }
            catch (SourceSynchronizationInProgressException)
            {
                logger.LogInformation("Google Drive salary-sheet synchronization skipped because another run is active.");
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(exception, "Google Drive salary-sheet synchronization failed.");
            }
            await Task.Delay(interval, stoppingToken);
        }
    }
}
