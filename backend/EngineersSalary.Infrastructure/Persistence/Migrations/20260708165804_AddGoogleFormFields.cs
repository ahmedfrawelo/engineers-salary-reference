using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGoogleFormFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AnnualBonus",
                table: "SalaryReports",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DailyWorkHours",
                table: "SalaryReports",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExtraDayOff",
                table: "SalaryReports",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HighestEducation",
                table: "SalaryReports",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HousingProvided",
                table: "SalaryReports",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NegotiationAdvice",
                table: "SalaryReports",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProfessionalCertificate",
                table: "SalaryReports",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecommendField",
                table: "SalaryReports",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SalaryFairness",
                table: "SalaryReports",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TransportationProvided",
                table: "SalaryReports",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnnualBonus",
                table: "SalaryReports");

            migrationBuilder.DropColumn(
                name: "DailyWorkHours",
                table: "SalaryReports");

            migrationBuilder.DropColumn(
                name: "ExtraDayOff",
                table: "SalaryReports");

            migrationBuilder.DropColumn(
                name: "HighestEducation",
                table: "SalaryReports");

            migrationBuilder.DropColumn(
                name: "HousingProvided",
                table: "SalaryReports");

            migrationBuilder.DropColumn(
                name: "NegotiationAdvice",
                table: "SalaryReports");

            migrationBuilder.DropColumn(
                name: "ProfessionalCertificate",
                table: "SalaryReports");

            migrationBuilder.DropColumn(
                name: "RecommendField",
                table: "SalaryReports");

            migrationBuilder.DropColumn(
                name: "SalaryFairness",
                table: "SalaryReports");

            migrationBuilder.DropColumn(
                name: "TransportationProvided",
                table: "SalaryReports");
        }
    }
}
