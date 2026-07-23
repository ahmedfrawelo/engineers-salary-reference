using System.Diagnostics;

namespace EngineersSalary.Api.Middleware;

public sealed class CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
{
    public const string HeaderName = "X-Correlation-ID";
    public const string ItemName = "CorrelationId";

    public async Task InvokeAsync(HttpContext context)
    {
        var supplied = context.Request.Headers[HeaderName].ToString().Trim();
        var correlationId = IsValid(supplied)
            ? supplied
            : Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("N");

        context.Items[ItemName] = correlationId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        using (logger.BeginScope(new Dictionary<string, object> { [ItemName] = correlationId }))
        {
            await next(context);
        }
    }

    private static bool IsValid(string value) =>
        value.Length is >= 8 and <= 64 &&
        value.All(character => char.IsLetterOrDigit(character) || character is '-' or '_' or '.' or ':');
}
