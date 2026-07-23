using EngineersSalary.Infrastructure;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations;

[DbContext(typeof(EngineersSalaryDbContext))]
[Migration("20260710131000_AddSalaryReportReadFilterIndexes")]
public partial class AddSalaryReportReadFilterIndexes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE INDEX IX_SalaryReportYearsOfExperience_Value ON dbo.SalaryReportYearsOfExperience(Value);
            CREATE INDEX IX_SalaryReportWorkModes_Value ON dbo.SalaryReportWorkModes(Value);
            CREATE INDEX IX_SalaryReportCompensations_Currency_MonthlyNetSalary ON dbo.SalaryReportCompensations(Currency, MonthlyNetSalary);
            CREATE INDEX IX_SalaryReportHousing_Value ON dbo.SalaryReportHousing(Value);
            CREATE INDEX IX_SalaryReportTransportation_Value ON dbo.SalaryReportTransportation(Value);
            CREATE INDEX IX_SalaryReportAnnualBonuses_Value ON dbo.SalaryReportAnnualBonuses(Value);
            CREATE INDEX IX_SalaryReportSalaryFairness_Value ON dbo.SalaryReportSalaryFairness(Value);
            CREATE INDEX IX_SalaryReportFieldRecommendations_Value ON dbo.SalaryReportFieldRecommendations(Value);
            CREATE INDEX IX_SalaryReportProfessionalCertificates_Value ON dbo.SalaryReportProfessionalCertificates(Value);
            CREATE INDEX IX_SalaryReportEducations_Value ON dbo.SalaryReportEducations(Value);
            CREATE INDEX IX_SalaryReportDailyWorkHours_Value ON dbo.SalaryReportDailyWorkHours(Value);
            CREATE INDEX IX_SalaryReportAdditionalDaysOff_Value ON dbo.SalaryReportAdditionalDaysOff(Value);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IX_SalaryReportYearsOfExperience_Value ON dbo.SalaryReportYearsOfExperience;
            DROP INDEX IX_SalaryReportWorkModes_Value ON dbo.SalaryReportWorkModes;
            DROP INDEX IX_SalaryReportCompensations_Currency_MonthlyNetSalary ON dbo.SalaryReportCompensations;
            DROP INDEX IX_SalaryReportHousing_Value ON dbo.SalaryReportHousing;
            DROP INDEX IX_SalaryReportTransportation_Value ON dbo.SalaryReportTransportation;
            DROP INDEX IX_SalaryReportAnnualBonuses_Value ON dbo.SalaryReportAnnualBonuses;
            DROP INDEX IX_SalaryReportSalaryFairness_Value ON dbo.SalaryReportSalaryFairness;
            DROP INDEX IX_SalaryReportFieldRecommendations_Value ON dbo.SalaryReportFieldRecommendations;
            DROP INDEX IX_SalaryReportProfessionalCertificates_Value ON dbo.SalaryReportProfessionalCertificates;
            DROP INDEX IX_SalaryReportEducations_Value ON dbo.SalaryReportEducations;
            DROP INDEX IX_SalaryReportDailyWorkHours_Value ON dbo.SalaryReportDailyWorkHours;
            DROP INDEX IX_SalaryReportAdditionalDaysOff_Value ON dbo.SalaryReportAdditionalDaysOff;
            """);
    }
}
