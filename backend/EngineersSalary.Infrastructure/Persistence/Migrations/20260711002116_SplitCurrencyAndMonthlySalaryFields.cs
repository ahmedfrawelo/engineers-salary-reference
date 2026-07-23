using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SplitCurrencyAndMonthlySalaryFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW dbo.vwSalaryReportReadRows;");

            migrationBuilder.CreateTable(
                name: "SalaryReportCurrencies",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportCurrencies", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportCurrencies_Value", "LEN(LTRIM(RTRIM([Value]))) BETWEEN 1 AND 8");
                    table.ForeignKey(
                        name: "FK_SalaryReportCurrencies_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportMonthlyNetSalaries",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportMonthlyNetSalaries", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportMonthlyNetSalaries_Value", "[Value] > 0 AND [Value] <= 10000000");
                    table.ForeignKey(
                        name: "FK_SalaryReportMonthlyNetSalaries_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                INSERT dbo.SalaryReportCurrencies (SalaryReportId, Value)
                SELECT SalaryReportId, Currency FROM dbo.SalaryReportCompensations;

                INSERT dbo.SalaryReportMonthlyNetSalaries (SalaryReportId, Value)
                SELECT SalaryReportId, MonthlyNetSalary FROM dbo.SalaryReportCompensations;
                """);

            migrationBuilder.DropTable(
                name: "SalaryReportCompensations");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportCurrencies_Value",
                table: "SalaryReportCurrencies",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportMonthlyNetSalaries_Value",
                table: "SalaryReportMonthlyNetSalaries",
                column: "Value");

            migrationBuilder.Sql(CreateReadView(splitFields: true));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW dbo.vwSalaryReportReadRows;");

            migrationBuilder.CreateTable(
                name: "SalaryReportCompensations",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    MonthlyNetSalary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportCompensations", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportCompensations_Currency", "LEN(LTRIM(RTRIM([Currency]))) BETWEEN 1 AND 8");
                    table.CheckConstraint("CK_SalaryReportCompensations_MonthlyNetSalary", "[MonthlyNetSalary] > 0 AND [MonthlyNetSalary] <= 10000000");
                    table.ForeignKey(
                        name: "FK_SalaryReportCompensations_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                INSERT dbo.SalaryReportCompensations (SalaryReportId, Currency, MonthlyNetSalary)
                SELECT c.SalaryReportId, c.Value, s.Value
                FROM dbo.SalaryReportCurrencies c
                INNER JOIN dbo.SalaryReportMonthlyNetSalaries s ON s.SalaryReportId = c.SalaryReportId;
                """);

            migrationBuilder.DropTable(
                name: "SalaryReportCurrencies");

            migrationBuilder.DropTable(
                name: "SalaryReportMonthlyNetSalaries");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportCompensations_Currency_MonthlyNetSalary",
                table: "SalaryReportCompensations",
                columns: new[] { "Currency", "MonthlyNetSalary" });

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportCompensations_MonthlyNetSalary",
                table: "SalaryReportCompensations",
                column: "MonthlyNetSalary");

            migrationBuilder.Sql(CreateReadView(splitFields: false));
        }

        private static string CreateReadView(bool splitFields)
        {
            var currencyProjection = splitFields ? "cu.Value" : "cp.Currency";
            var salaryProjection = splitFields ? "ms.Value" : "cp.MonthlyNetSalary";
            var compensationJoins = splitFields
                ? """
                  INNER JOIN dbo.SalaryReportCurrencies cu ON cu.SalaryReportId = r.Id
                  INNER JOIN dbo.SalaryReportMonthlyNetSalaries ms ON ms.SalaryReportId = r.Id
                  """
                : "INNER JOIN dbo.SalaryReportCompensations cp ON cp.SalaryReportId = r.Id";

            return $"""
                CREATE VIEW dbo.vwSalaryReportReadRows AS
                SELECT r.Id, d.Value AS Discipline, co.Value AS Country, ci.Value AS City,
                       y.Value AS YearsOfExperience, ct.Value AS CompanyType, wm.Value AS WorkMode,
                       {currencyProjection} AS Currency, {salaryProjection} AS MonthlyNetSalary,
                       h.Value AS HousingProvided, t.Value AS TransportationProvided,
                       ab.Value AS AnnualBonus, sf.Value AS SalaryFairness,
                       fr.Value AS RecommendField, na.Value AS NegotiationAdvice,
                       pc.Value AS ProfessionalCertificate, b.Value AS Benefits,
                       e.Value AS HighestEducation, dh.Value AS DailyWorkHours,
                       ad.Value AS ExtraDayOff
                FROM dbo.SalaryReports r
                INNER JOIN dbo.SalaryReportDisciplines d ON d.SalaryReportId = r.Id
                INNER JOIN dbo.SalaryReportCountries co ON co.SalaryReportId = r.Id
                INNER JOIN dbo.SalaryReportCities ci ON ci.SalaryReportId = r.Id
                INNER JOIN dbo.SalaryReportYearsOfExperience y ON y.SalaryReportId = r.Id
                INNER JOIN dbo.SalaryReportCompanyTypes ct ON ct.SalaryReportId = r.Id
                INNER JOIN dbo.SalaryReportWorkModes wm ON wm.SalaryReportId = r.Id
                {compensationJoins}
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
                WHERE r.Status = 'Published';
                """;
        }
    }
}
