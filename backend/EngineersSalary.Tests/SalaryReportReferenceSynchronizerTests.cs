using EngineersSalary.Domain;
using EngineersSalary.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EngineersSalary.Tests;

public sealed class SalaryReportReferenceSynchronizerTests : IAsyncLifetime
{
    private readonly SalaryApiFactory factory = new();

    public Task InitializeAsync() => factory.InitializeDatabaseAsync();

    public async Task DisposeAsync()
    {
        await factory.DeleteDatabaseAsync();
        await factory.DisposeAsync();
    }

    [Fact]
    public async Task SynchronizeAsync_reconciles_changed_and_removed_field_relationships()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EngineersSalaryDbContext>();
        var report = new SalaryReport(
            "Egypt", "Cairo", "Mechanical", 5, "Consultant", "Hybrid", "EGP", 25_000,
            DateOnly.FromDateTime(DateTime.UtcNow), housingProvided: "Yes");
        dbContext.SalaryReports.Add(report);
        await dbContext.SaveChangesAsync();
        await SalaryReportReferenceSynchronizer.SynchronizeAsync(dbContext, CancellationToken.None);

        var originalCountryLink = await LoadLinkAsync(dbContext, report.Id, "country");
        Assert.Equal("Egypt", originalCountryLink.ReferenceValue.Value);
        Assert.NotNull(await LoadLinkAsync(dbContext, report.Id, "housing"));

        report.RefreshImportedValues(
            report.Discipline, report.CompanyType, report.City, "France", report.MonthlyNetSalary,
            report.Currency, report.YearsOfExperience, report.WorkMode, report.Benefits, null,
            report.TransportationProvided, report.AnnualBonus, report.SalaryFairness,
            report.RecommendField, report.NegotiationAdvice, report.ProfessionalCertificate,
            report.HighestEducation, report.DailyWorkHours, report.ExtraDayOff);
        await dbContext.SaveChangesAsync();
        await SalaryReportReferenceSynchronizer.SynchronizeAsync(dbContext, CancellationToken.None);

        var updatedCountryLink = await LoadLinkAsync(dbContext, report.Id, "country");
        Assert.Equal("France", updatedCountryLink.ReferenceValue.Value);
        Assert.NotEqual(originalCountryLink.ReferenceValueId, updatedCountryLink.ReferenceValueId);
        Assert.Null(await TryLoadLinkAsync(dbContext, report.Id, "housing"));
    }

    private static async Task<SalaryReportReference> LoadLinkAsync(
        EngineersSalaryDbContext dbContext,
        Guid reportId,
        string fieldCode) => Assert.IsType<SalaryReportReference>(
            await TryLoadLinkAsync(dbContext, reportId, fieldCode));

    private static Task<SalaryReportReference?> TryLoadLinkAsync(
        EngineersSalaryDbContext dbContext,
        Guid reportId,
        string fieldCode) => dbContext.SalaryReportReferences
            .AsNoTracking()
            .Include(link => link.ReferenceValue)
            .SingleOrDefaultAsync(link => link.SalaryReportId == reportId && link.FieldCode == fieldCode);
}
