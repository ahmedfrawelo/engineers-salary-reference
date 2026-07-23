using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSalaryReportSourceTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SalaryReportSourceRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SalaryReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ExternalRowId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ContentHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SynchronizedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportSourceRecords", x => x.Id);
                    table.ForeignKey("FK_SalaryReportSourceRecords_SalaryReports_SalaryReportId", x => x.SalaryReportId, "SalaryReports", "Id", onDelete: ReferentialAction.Cascade);
                });
            migrationBuilder.CreateIndex(name: "IX_SalaryReportSourceRecords_SalaryReportId", table: "SalaryReportSourceRecords", column: "SalaryReportId");
            migrationBuilder.CreateIndex(name: "IX_SalaryReportSourceRecords_SourceName_ExternalRowId", table: "SalaryReportSourceRecords", columns: new[] { "SourceName", "ExternalRowId" }, unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "SalaryReportSourceRecords");
        }
    }
}
