using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSalarySubmissionIdempotency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SalarySubmissionIdempotencyRecords",
                columns: table => new
                {
                    Key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RequestHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SalaryReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalarySubmissionIdempotencyRecords", x => x.Key);
                    table.ForeignKey(
                        name: "FK_SalarySubmissionIdempotencyRecords_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalarySubmissionIdempotencyRecords_CreatedAt",
                table: "SalarySubmissionIdempotencyRecords",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SalarySubmissionIdempotencyRecords_SalaryReportId",
                table: "SalarySubmissionIdempotencyRecords",
                column: "SalaryReportId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SalarySubmissionIdempotencyRecords");
        }
    }
}
