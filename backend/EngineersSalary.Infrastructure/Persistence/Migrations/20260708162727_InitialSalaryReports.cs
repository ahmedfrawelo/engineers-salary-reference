using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSalaryReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SalaryReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Discipline = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    RoleTitle = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Seniority = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    CompanyName = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    CompanySector = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Country = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MonthlyNetSalary = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    YearsOfExperience = table.Column<int>(type: "int", nullable: false),
                    EmploymentType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    WorkMode = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    SubmittedAt = table.Column<DateOnly>(type: "date", nullable: false),
                    IsAnonymous = table.Column<bool>(type: "bit", nullable: false),
                    Benefits = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReports", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReports_Discipline_Seniority_City",
                table: "SalaryReports",
                columns: new[] { "Discipline", "Seniority", "City" });

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReports_SubmittedAt",
                table: "SalaryReports",
                column: "SubmittedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SalaryReports");
        }
    }
}
