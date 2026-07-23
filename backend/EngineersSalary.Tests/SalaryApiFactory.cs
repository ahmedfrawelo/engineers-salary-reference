using EngineersSalary.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;

namespace EngineersSalary.Tests;

internal sealed class SalaryApiFactory : WebApplicationFactory<Program>
{
    private readonly string databaseName = $"EngineersSalary_Integration_{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = ConnectionString,
                ["GoogleSheetSalaryImport:Enabled"] = "false",
                ["IdempotencyMaintenance:Enabled"] = "false",
            });
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<EngineersSalaryDbContext>>();
            services.RemoveAll<EngineersSalaryDbContext>();
            services.AddDbContext<EngineersSalaryDbContext>(options =>
                options.UseSqlServer(ConnectionString));
        });
        builder.ConfigureLogging(logging => logging.SetMinimumLevel(LogLevel.Warning));
    }

    internal async Task InitializeDatabaseAsync()
    {
        await using var scope = Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EngineersSalaryDbContext>();
        await dbContext.Database.MigrateAsync();
    }

    internal async Task DeleteDatabaseAsync()
    {
        await using var scope = Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EngineersSalaryDbContext>();
        await dbContext.Database.EnsureDeletedAsync();
    }

    private string ConnectionString
    {
        get
        {
            var ciConnection = Environment.GetEnvironmentVariable("TEST_SQL_CONNECTION_STRING");
            if (string.IsNullOrWhiteSpace(ciConnection))
            {
                return $"Server=(localdb)\\mssqllocaldb;Database={databaseName};Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";
            }

            var builder = new SqlConnectionStringBuilder(ciConnection)
            {
                InitialCatalog = databaseName
            };
            return builder.ConnectionString;
        }
    }
}
