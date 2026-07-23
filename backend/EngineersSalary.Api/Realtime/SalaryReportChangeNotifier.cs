using System.Collections.Concurrent;
using System.Threading.Channels;
using EngineersSalary.Application;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.Extensions.Logging;

namespace EngineersSalary.Api.Realtime;

public sealed class SalaryReportChangeNotifier(
    IOutputCacheStore? outputCacheStore = null,
    ILogger<SalaryReportChangeNotifier>? logger = null) : ISalaryReportChangeNotifier
{
    private readonly ConcurrentDictionary<Guid, Channel<SalaryReportChangeNotification>> subscribers = new();

    public int ActiveSubscriberCount => subscribers.Count;

    public async ValueTask PublishAsync(
        SalaryReportChangeNotification notification,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (outputCacheStore is not null)
        {
            try
            {
                await outputCacheStore.EvictByTagAsync("salary-reports", cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger?.LogWarning(
                    exception,
                    "Salary report cache eviction failed; realtime delivery will continue.");
            }
        }

        foreach (var subscriber in subscribers.Values)
        {
            subscriber.Writer.TryWrite(notification);
        }
    }

    public async IAsyncEnumerable<SalaryReportChangeNotification> SubscribeAsync(
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<SalaryReportChangeNotification>(new BoundedChannelOptions(16)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        });
        subscribers[id] = channel;

        try
        {
            await foreach (var notification in channel.Reader.ReadAllAsync(cancellationToken))
            {
                yield return notification;
            }
        }
        finally
        {
            subscribers.TryRemove(id, out _);
            channel.Writer.TryComplete();
        }
    }
}
