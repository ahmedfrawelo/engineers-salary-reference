using EngineersSalary.Application;
using EngineersSalary.Api.Realtime;
using EngineersSalary.Api.Middleware;
using EngineersSalary.Infrastructure;
using FluentValidation;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsProduction())
{
    builder.Services.AddOptions<ProductionDatabaseOptions>()
        .Bind(builder.Configuration.GetSection("ConnectionStrings"))
        .Validate(options => ProductionDatabaseOptions.IsSecure(
                options.DefaultConnection,
                builder.Configuration["Database:Provider"] ?? DatabaseProviderOptions.SqlServer),
            "DefaultConnection is required and must use encrypted transport, bounded timeouts, and a bounded connection pool.")
        .ValidateOnStart();
    builder.Services.AddOptions<ProductionSecretOptions>()
        .Bind(builder.Configuration)
        .Validate(options => options.Health.DiagnosticKey.Length >= 32 &&
                             options.GoogleSheetSalaryImport.SynchronizationKey.Length >= 32,
            "Production diagnostic and source synchronization keys must be at least 32 characters.")
        .ValidateOnStart();
}

builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
    options.Limits.MaxRequestBodySize = 64 * 1024;
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
});
var defaultUrl = builder.Environment.IsDevelopment()
    ? "http://localhost:5145"
    : "http://0.0.0.0:8080";
var platformPort = Environment.GetEnvironmentVariable("PORT");
var configuredUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS")
    ?? (int.TryParse(platformPort, out var port) && port is > 0 and <= 65535
        ? $"http://0.0.0.0:{port}"
        : defaultUrl);
builder.WebHost.UseUrls(configuredUrls);

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
    options.ForwardLimit = 2;
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton<ISalaryReportChangeNotifier, SalaryReportChangeNotifier>();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
        if (context.HttpContext.Items.TryGetValue(CorrelationIdMiddleware.ItemName, out var correlationId))
        {
            context.ProblemDetails.Extensions["correlationId"] = correlationId;
        }
    };
});
builder.Services.AddRequestTimeouts(options =>
{
    options.DefaultPolicy = new RequestTimeoutPolicy
    {
        Timeout = TimeSpan.FromSeconds(20),
        TimeoutStatusCode = StatusCodes.Status504GatewayTimeout
    };
    options.AddPolicy("source-sync", TimeSpan.FromMinutes(2));
});
builder.Services.AddHealthChecks();
builder.Services.AddResponseCaching();
builder.Services.AddOutputCache(options =>
{
    options.AddPolicy("salary-read", policy => policy
        .Expire(TimeSpan.FromSeconds(20))
        .SetVaryByQuery("*")
        .Tag("salary-reports"));
    options.AddPolicy("salary-options", policy => policy
        .Expire(TimeSpan.FromMinutes(5))
        .Tag("salary-reports"));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("public-api", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 180,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("salary-submission", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 12,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("source-sync", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 2,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("realtime", context =>
        RateLimitPartition.GetConcurrencyLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new ConcurrencyLimiterOptions
            {
                PermitLimit = 5,
                QueueLimit = 0
            }));
});
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

var configuredOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()
    ?? [];
var allowedOrigins = appOrigins(builder.Environment, configuredOrigins);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

if (builder.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var database = scope.ServiceProvider.GetRequiredService<EngineersSalaryDbContext>();
    await database.Database.MigrateAsync();
}

app.UseForwardedHeaders();
app.UseMiddleware<CorrelationIdMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers.XFrameOptions = "DENY";
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
    context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    await next();
});
app.UseCors("Frontend");
app.UseRequestTimeouts();
app.UseResponseCaching();
app.UseOutputCache();
app.UseResponseCompression();
app.UseRateLimiter();
app.MapControllers();
app.MapGet("/health/live", () => Results.Ok(new { status = "Healthy" }));
app.MapGet("/health/ready", () => Results.Ok(new { status = "Ready" }));

app.Run();

static string[] appOrigins(IHostEnvironment environment, string[] configuredOrigins)
{
    var origins = configuredOrigins
        .Where(origin => Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
                         (uri.Scheme == Uri.UriSchemeHttps || environment.IsDevelopment()))
        .Select(origin => origin.TrimEnd('/'))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();
    if (environment.IsDevelopment())
    {
        origins.AddRange(["http://localhost:4200", "http://127.0.0.1:4200", "http://localhost:4300", "http://127.0.0.1:4300"]);
    }
    if (origins.Count == 0) throw new InvalidOperationException("Cors:AllowedOrigins must contain at least one valid origin.");
    return origins.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
}

public partial class Program
{
}
