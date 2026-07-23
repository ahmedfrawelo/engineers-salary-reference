using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSalaryDataIntegrityConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportYearsOfExperience_Value",
                table: "SalaryReportYearsOfExperience",
                sql: "[Value] BETWEEN 0 AND 60");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportWorkModes_Value",
                table: "SalaryReportWorkModes",
                sql: "[Value] IS NOT NULL AND LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportTransportation_Value",
                table: "SalaryReportTransportation",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportSalaryFairness_Value",
                table: "SalaryReportSalaryFairness",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReports_Status",
                table: "SalaryReports",
                sql: "[Status] IN ('Draft', 'Published', 'Hidden')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportProfessionalCertificates_Value",
                table: "SalaryReportProfessionalCertificates",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportNotes_Value",
                table: "SalaryReportNotes",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportNegotiationAdvice_Value",
                table: "SalaryReportNegotiationAdvice",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportHousing_Value",
                table: "SalaryReportHousing",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportFieldRecommendations_Value",
                table: "SalaryReportFieldRecommendations",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportEducations_Value",
                table: "SalaryReportEducations",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportDisciplines_Value",
                table: "SalaryReportDisciplines",
                sql: "[Value] IS NOT NULL AND LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportDailyWorkHours_Value",
                table: "SalaryReportDailyWorkHours",
                sql: "[Value] IS NULL OR [Value] BETWEEN 0 AND 24");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportCountries_Value",
                table: "SalaryReportCountries",
                sql: "[Value] IS NOT NULL AND LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportCompensations_Currency",
                table: "SalaryReportCompensations",
                sql: "LEN(LTRIM(RTRIM([Currency]))) BETWEEN 1 AND 8");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportCompensations_MonthlyNetSalary",
                table: "SalaryReportCompensations",
                sql: "[MonthlyNetSalary] > 0 AND [MonthlyNetSalary] <= 10000000");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportCompanyTypes_Value",
                table: "SalaryReportCompanyTypes",
                sql: "[Value] IS NOT NULL AND LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportCities_Value",
                table: "SalaryReportCities",
                sql: "[Value] IS NOT NULL AND LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportBenefits_Value",
                table: "SalaryReportBenefits",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportAnnualBonuses_Value",
                table: "SalaryReportAnnualBonuses",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SalaryReportAdditionalDaysOff_Value",
                table: "SalaryReportAdditionalDaysOff",
                sql: "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportYearsOfExperience_Value",
                table: "SalaryReportYearsOfExperience");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportWorkModes_Value",
                table: "SalaryReportWorkModes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportTransportation_Value",
                table: "SalaryReportTransportation");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportSalaryFairness_Value",
                table: "SalaryReportSalaryFairness");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReports_Status",
                table: "SalaryReports");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportProfessionalCertificates_Value",
                table: "SalaryReportProfessionalCertificates");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportNotes_Value",
                table: "SalaryReportNotes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportNegotiationAdvice_Value",
                table: "SalaryReportNegotiationAdvice");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportHousing_Value",
                table: "SalaryReportHousing");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportFieldRecommendations_Value",
                table: "SalaryReportFieldRecommendations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportEducations_Value",
                table: "SalaryReportEducations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportDisciplines_Value",
                table: "SalaryReportDisciplines");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportDailyWorkHours_Value",
                table: "SalaryReportDailyWorkHours");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportCountries_Value",
                table: "SalaryReportCountries");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportCompensations_Currency",
                table: "SalaryReportCompensations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportCompensations_MonthlyNetSalary",
                table: "SalaryReportCompensations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportCompanyTypes_Value",
                table: "SalaryReportCompanyTypes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportCities_Value",
                table: "SalaryReportCities");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportBenefits_Value",
                table: "SalaryReportBenefits");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportAnnualBonuses_Value",
                table: "SalaryReportAnnualBonuses");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SalaryReportAdditionalDaysOff_Value",
                table: "SalaryReportAdditionalDaysOff");
        }
    }
}
