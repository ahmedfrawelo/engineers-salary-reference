using EngineersSalary.Infrastructure;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations;

[DbContext(typeof(EngineersSalaryDbContext))]
[Migration("20260710124500_FilterSalaryReportReadViewToPublished")]
public partial class FilterSalaryReportReadViewToPublished : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE OR ALTER VIEW dbo.vwSalaryReportReadRows AS
            SELECT r.Id, d.Value AS Discipline, co.Value AS Country, ci.Value AS City,
                   y.Value AS YearsOfExperience, ct.Value AS CompanyType, wm.Value AS WorkMode,
                   cp.Currency, cp.MonthlyNetSalary, h.Value AS HousingProvided,
                   t.Value AS TransportationProvided, ab.Value AS AnnualBonus,
                   sf.Value AS SalaryFairness, fr.Value AS RecommendField,
                   na.Value AS NegotiationAdvice, pc.Value AS ProfessionalCertificate,
                   b.Value AS Benefits, e.Value AS HighestEducation,
                   dh.Value AS DailyWorkHours, ad.Value AS ExtraDayOff, n.Value AS Notes
            FROM dbo.SalaryReports r
            INNER JOIN dbo.SalaryReportDisciplines d ON d.SalaryReportId = r.Id
            INNER JOIN dbo.SalaryReportCountries co ON co.SalaryReportId = r.Id
            INNER JOIN dbo.SalaryReportCities ci ON ci.SalaryReportId = r.Id
            INNER JOIN dbo.SalaryReportYearsOfExperience y ON y.SalaryReportId = r.Id
            INNER JOIN dbo.SalaryReportCompanyTypes ct ON ct.SalaryReportId = r.Id
            INNER JOIN dbo.SalaryReportWorkModes wm ON wm.SalaryReportId = r.Id
            INNER JOIN dbo.SalaryReportCompensations cp ON cp.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportHousing h ON h.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportTransportation t ON t.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportAnnualBonuses ab ON ab.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportSalaryFairness sf ON sf.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportFieldRecommendations fr ON fr.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportNegotiationAdvice na ON na.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportProfessionalCertificates pc ON pc.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportBenefits b ON b.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportEducations e ON e.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportDailyWorkHours dh ON dh.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportAdditionalDaysOff ad ON ad.SalaryReportId = r.Id
            LEFT JOIN dbo.SalaryReportNotes n ON n.SalaryReportId = r.Id
            WHERE r.Status = 'Published';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER VIEW dbo.vwSalaryReportReadRows AS SELECT * FROM dbo.vwSalaryReportReadRows;");
    }
}
