using EngineersSalary.Application;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EngineersSalary.Infrastructure;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var provider = configuration[$"{DatabaseProviderOptions.SectionName}:Provider"]
            ?? DatabaseProviderOptions.SqlServer;
        // Production validates this at host startup. Keeping registration lazy lets
        // WebApplicationFactory replace the DbContext before it is resolved in tests.
        var connectionString = configuration.GetConnectionString("DefaultConnection") ?? string.Empty;

        services.AddOptions<DatabaseProviderOptions>()
            .Bind(configuration.GetSection(DatabaseProviderOptions.SectionName))
            .Validate(options => options.Provider is DatabaseProviderOptions.SqlServer or DatabaseProviderOptions.PostgreSql,
                "Database:Provider must be SqlServer or PostgreSQL.")
            .ValidateOnStart();
        services.AddDbContext<EngineersSalaryDbContext>(options =>
        {
            if (string.Equals(provider, DatabaseProviderOptions.PostgreSql, StringComparison.OrdinalIgnoreCase))
            {
                options.UseNpgsql(connectionString, postgres =>
                {
                    postgres.CommandTimeout(15);
                    postgres.EnableRetryOnFailure(3, TimeSpan.FromSeconds(2), null);
                    postgres.MigrationsAssembly("EngineersSalary.PostgreSqlMigrations");
                });
                return;
            }

            options.UseSqlServer(connectionString, sqlServer =>
            {
                sqlServer.CommandTimeout(15);
                sqlServer.EnableRetryOnFailure(3, TimeSpan.FromSeconds(2), null);
            });
        });

        services.AddScoped<ISalaryReportRepository, EfSalaryReportRepository>();
        services.AddScoped<ISalaryReportReadRepository, EfSalaryReportReadRepository>();
        services.AddScoped<ISystemReadinessCheck, DatabaseReadinessCheck>();
        services.AddOptions<GoogleSheetSalaryImportOptions>()
            .Bind(configuration.GetSection(GoogleSheetSalaryImportOptions.SectionName))
            .Validate(options =>
                (!string.IsNullOrWhiteSpace(options.WorkbookPath) ||
                 Uri.TryCreate(options.WorkbookUrl, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps) &&
                options.MaxDownloadBytes is >= 1024 and <= 100 * 1024 * 1024 &&
                options.DownloadTimeoutSeconds is >= 5 and <= 120 &&
                options.MaxRowsPerImport is >= 1 and <= 500_000,
                "Google Sheet import requires a local path or HTTPS URL and safe resource limits.")
            .ValidateOnStart();
        services.AddOptions<IdempotencyMaintenanceOptions>()
            .Bind(configuration.GetSection(IdempotencyMaintenanceOptions.SectionName))
            .Validate(options => options.RetentionDays is >= 7 and <= 365 && options.IntervalHours is >= 1 and <= 168,
                "Idempotency maintenance limits are invalid.")
            .ValidateOnStart();
        services.AddHttpClient("GoogleDriveSalaryImport");
        services.AddScoped<IGoogleSheetSalaryImportService, GoogleSheetSalaryImportService>();
        // Periodic workers are intentionally not registered. Container Apps scales this API to
        // zero, so synchronization is exposed as an authenticated on-demand operation instead.

        return services;
    }
}
