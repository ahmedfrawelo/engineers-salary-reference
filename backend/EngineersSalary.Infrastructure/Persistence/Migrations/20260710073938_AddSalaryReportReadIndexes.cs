using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSalaryReportReadIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_SalaryReports_Status_Discipline_Seniority",
                table: "SalaryReports",
                columns: new[] { "Status", "Discipline", "Seniority" });

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReports_Status_SubmittedAt",
                table: "SalaryReports",
                columns: new[] { "Status", "SubmittedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SalaryReports_Status_Discipline_Seniority",
                table: "SalaryReports");

            migrationBuilder.DropIndex(
                name: "IX_SalaryReports_Status_SubmittedAt",
                table: "SalaryReports");
        }
    }
}
