using EngineersSalary.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace EngineersSalary.Tests;

public sealed class CorrelationIdMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_preserves_valid_correlation_id()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationIdMiddleware.HeaderName] = "salary-request-123";
        object? observed = null;
        var middleware = new CorrelationIdMiddleware(
            next: httpContext =>
            {
                observed = httpContext.Items[CorrelationIdMiddleware.ItemName];
                return Task.CompletedTask;
            },
            NullLogger<CorrelationIdMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.Equal("salary-request-123", observed);
    }

    [Fact]
    public async Task InvokeAsync_replaces_unsafe_correlation_id()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationIdMiddleware.HeaderName] = "unsafe value\r\n";
        string? observed = null;
        var middleware = new CorrelationIdMiddleware(
            next: httpContext =>
            {
                observed = httpContext.Items[CorrelationIdMiddleware.ItemName]?.ToString();
                return Task.CompletedTask;
            },
            NullLogger<CorrelationIdMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.NotNull(observed);
        Assert.NotEqual("unsafe value", observed);
        Assert.Matches("^[a-f0-9]{32}$", observed!);
    }
}
