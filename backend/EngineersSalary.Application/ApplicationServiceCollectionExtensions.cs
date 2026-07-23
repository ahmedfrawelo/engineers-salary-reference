using Microsoft.Extensions.DependencyInjection;

namespace EngineersSalary.Application;

public static class ApplicationServiceCollectionExtensions
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<SalaryReportService>();
        services.AddScoped<SalaryReportReadService>();
        return services;
    }
}
