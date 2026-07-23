using System.Text.Json;
using EngineersSalary.Application;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.AspNetCore.RateLimiting;

namespace EngineersSalary.Api.Controllers;

[ApiController]
[Route("api/salary-reports/events")]
[EnableRateLimiting("realtime")]
public sealed class SalaryReportEventsController(ISalaryReportChangeNotifier changeNotifier) : ControllerBase
{
    [HttpGet]
    [DisableRequestTimeout]
    public async Task Get(CancellationToken cancellationToken)
    {
        Response.StatusCode = StatusCodes.Status200OK;
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache, no-store";
        Response.Headers.Append("X-Accel-Buffering", "no");
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        await Response.WriteAsync("retry: 5000\n: connected\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);

        await using var subscriber = changeNotifier.SubscribeAsync(cancellationToken).GetAsyncEnumerator(cancellationToken);
        var pendingNotification = subscriber.MoveNextAsync().AsTask();
        while (!cancellationToken.IsCancellationRequested)
        {
            var heartbeat = Task.Delay(TimeSpan.FromSeconds(15), cancellationToken);
            if (await Task.WhenAny(pendingNotification, heartbeat) != pendingNotification)
            {
                await Response.WriteAsync(": heartbeat\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
                continue;
            }

            if (!await pendingNotification) break;
            var notification = subscriber.Current;
            await Response.WriteAsync(
                FormatEvent(notification.Action, notification.ChangedCount, notification.OccurredAt),
                cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
            pendingNotification = subscriber.MoveNextAsync().AsTask();
        }
    }

    private static string FormatEvent(string action, int changedCount, DateTimeOffset occurredAt)
    {
        var message = new
        {
            type = "event",
            payload = new
            {
                module = "salary-reference",
                entityName = "salaryReport",
                action,
                occurredAt,
                changedFields = Array.Empty<string>(),
                channels = new[] { "salary-reports" },
                changedCount
            }
        };
        return $"data: {JsonSerializer.Serialize(message)}\n\n";
    }
}
