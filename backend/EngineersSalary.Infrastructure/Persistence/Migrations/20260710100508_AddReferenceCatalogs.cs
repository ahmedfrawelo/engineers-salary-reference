using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReferenceCatalogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReferenceCatalogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReferenceCatalogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ReferenceValues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CatalogId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParentValueId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Value = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    NormalizedValue = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReferenceValues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReferenceValues_ReferenceCatalogs_CatalogId",
                        column: x => x.CatalogId,
                        principalTable: "ReferenceCatalogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ReferenceValues_ReferenceValues_ParentValueId",
                        column: x => x.ParentValueId,
                        principalTable: "ReferenceValues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportReferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SalaryReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReferenceValueId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FieldCode = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportReferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalaryReportReferences_ReferenceValues_ReferenceValueId",
                        column: x => x.ReferenceValueId,
                        principalTable: "ReferenceValues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SalaryReportReferences_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReferenceCatalogs_Code",
                table: "ReferenceCatalogs",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReferenceValues_CatalogId_NormalizedValue",
                table: "ReferenceValues",
                columns: new[] { "CatalogId", "NormalizedValue" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReferenceValues_ParentValueId",
                table: "ReferenceValues",
                column: "ParentValueId");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportReferences_ReferenceValueId",
                table: "SalaryReportReferences",
                column: "ReferenceValueId");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportReferences_SalaryReportId_FieldCode",
                table: "SalaryReportReferences",
                columns: new[] { "SalaryReportId", "FieldCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SalaryReportReferences");

            migrationBuilder.DropTable(
                name: "ReferenceValues");

            migrationBuilder.DropTable(
                name: "ReferenceCatalogs");
        }
    }
}
