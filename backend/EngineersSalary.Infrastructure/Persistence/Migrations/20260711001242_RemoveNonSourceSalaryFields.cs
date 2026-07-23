using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveNonSourceSalaryFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW dbo.vwSalaryReportReadRows;");

            migrationBuilder.DropTable(
                name: "SalaryReportNotes");

            migrationBuilder.DropColumn(
                name: "IsAnonymous",
                table: "SalaryReports");

            migrationBuilder.Sql(CreateReadView(includeNotes: false));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW dbo.vwSalaryReportReadRows;");

            migrationBuilder.AddColumn<bool>(
                name: "IsAnonymous",
                table: "SalaryReports",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "SalaryReportNotes",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportNotes", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportNotes_Value", "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportNotes_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql(CreateReadView(includeNotes: true));
        }

        private static string CreateReadView(bool includeNotes)
        {
            var notesProjection = includeNotes ? ", n.Value AS Notes" : string.Empty;
            var notesJoin = includeNotes
                ? "LEFT JOIN dbo.SalaryReportNotes n ON n.SalaryReportId = r.Id"
                : string.Empty;

            return $"""
                CREATE VIEW dbo.vwSalaryReportReadRows AS
                SELECT r.Id, d.Value AS Discipline, co.Value AS Country, ci.Value AS City,
                       y.Value AS YearsOfExperience, ct.Value AS CompanyType, wm.Value AS WorkMode,
                       cp.Currency, cp.MonthlyNetSalary, h.Value AS HousingProvided,
                       t.Value AS TransportationProvided, ab.Value AS AnnualBonus,
                       sf.Value AS SalaryFairness, fr.Value AS RecommendField,
                       na.Value AS NegotiationAdvice, pc.Value AS ProfessionalCertificate,
                       b.Value AS Benefits, e.Value AS HighestEducation,
                       dh.Value AS DailyWorkHours, ad.Value AS ExtraDayOff{notesProjection}
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
                {notesJoin}
                WHERE r.Status = 'Published';
                """;
        }
    }
}
