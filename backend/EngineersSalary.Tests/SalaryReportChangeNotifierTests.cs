using EngineersSalary.Api.Realtime;
using EngineersSalary.Application;
using Microsoft.AspNetCore.OutputCaching;

namespace EngineersSalary.Tests;

public sealed class SalaryReportChangeNotifierTests
{
    [Fact]
    public async Task PublishAsync_delivers_notification_to_active_subscriber()
    {
        var notifier = new SalaryReportChangeNotifier();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        await using var subscriber = notifier.SubscribeAsync(timeout.Token).GetAsyncEnumerator(timeout.Token);
        var pendingMessage = subscriber.MoveNextAsync().AsTask();
        var expected = new SalaryReportChangeNotification("synchronized", 3, DateTimeOffset.UtcNow);

        await notifier.PublishAsync(expected, CancellationToken.None);

        Assert.True(await pendingMessage);
        Assert.Equal(expected, subscriber.Current);
    }

    [Fact]
    public async Task PublishAsync_evicts_salary_read_cache()
    {
        var cache = new RecordingOutputCacheStore();
        var notifier = new SalaryReportChangeNotifier(cache);

        await notifier.PublishAsync(
            new SalaryReportChangeNotification("created", 1, DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Equal(["salary-reports"], cache.EvictedTags);
    }

    [Fact]
    public async Task SubscribeAsync_removes_subscriber_after_disconnect()
    {
        var notifier = new SalaryReportChangeNotifier();
        using var cancellation = new CancellationTokenSource();
        var subscriber = notifier.SubscribeAsync(cancellation.Token).GetAsyncEnumerator(cancellation.Token);
        var pending = subscriber.MoveNextAsync().AsTask();

        Assert.Equal(1, notifier.ActiveSubscriberCount);
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        await subscriber.DisposeAsync();

        Assert.Equal(0, notifier.ActiveSubscriberCount);
    }

    [Fact]
    public async Task PublishAsync_delivers_realtime_event_when_cache_eviction_fails()
    {
        var notifier = new SalaryReportChangeNotifier(new ThrowingOutputCacheStore());
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        await using var subscriber = notifier.SubscribeAsync(timeout.Token).GetAsyncEnumerator(timeout.Token);
        var pendingMessage = subscriber.MoveNextAsync().AsTask();
        var expected = new SalaryReportChangeNotification("created", 1, DateTimeOffset.UtcNow);

        await notifier.PublishAsync(expected, CancellationToken.None);

        Assert.True(await pendingMessage);
        Assert.Equal(expected, subscriber.Current);
    }

    private sealed class RecordingOutputCacheStore : IOutputCacheStore
    {
        public List<string> EvictedTags { get; } = [];

        public ValueTask<byte[]?> GetAsync(string key, CancellationToken cancellationToken)
            => ValueTask.FromResult<byte[]?>(null);

        public ValueTask SetAsync(
            string key,
            byte[] value,
            string[]? tags,
            TimeSpan validFor,
            CancellationToken cancellationToken) => ValueTask.CompletedTask;

        public ValueTask EvictByTagAsync(string tag, CancellationToken cancellationToken)
        {
            EvictedTags.Add(tag);
            return ValueTask.CompletedTask;
        }
    }

    private sealed class ThrowingOutputCacheStore : IOutputCacheStore
    {
        public ValueTask<byte[]?> GetAsync(string key, CancellationToken cancellationToken)
            => ValueTask.FromResult<byte[]?>(null);

        public ValueTask SetAsync(
            string key,
            byte[] value,
            string[]? tags,
            TimeSpan validFor,
            CancellationToken cancellationToken) => ValueTask.CompletedTask;

        public ValueTask EvictByTagAsync(string tag, CancellationToken cancellationToken)
            => ValueTask.FromException(new InvalidOperationException("Cache unavailable."));
    }
}
