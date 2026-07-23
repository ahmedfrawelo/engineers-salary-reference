using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.PostgreSqlMigrations.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgreSql : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReferenceCatalogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReferenceCatalogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedAt = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReports", x => x.Id);
                    table.CheckConstraint("CK_SalaryReports_Status", "\"Status\" IN ('Draft', 'Published', 'Hidden')");
                });

            migrationBuilder.CreateTable(
                name: "ReferenceValues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CatalogId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentValueId = table.Column<Guid>(type: "uuid", nullable: true),
                    Value = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    NormalizedValue = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false)
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
                name: "SalaryReportAdditionalDaysOff",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportAdditionalDaysOff", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportAdditionalDaysOff_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportAdditionalDaysOff_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportAnnualBonuses",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportAnnualBonuses", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportAnnualBonuses_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportAnnualBonuses_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportBenefits",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportBenefits", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportBenefits_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportBenefits_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportCities",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportCities", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportCities_Value", "\"Value\" IS NOT NULL AND char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportCities_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportCompanyTypes",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportCompanyTypes", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportCompanyTypes_Value", "\"Value\" IS NOT NULL AND char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportCompanyTypes_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportCountries",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportCountries", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportCountries_Value", "\"Value\" IS NOT NULL AND char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportCountries_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportCurrencies",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportCurrencies", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportCurrencies_Value", "char_length(btrim(\"Value\")) BETWEEN 1 AND 8");
                    table.ForeignKey(
                        name: "FK_SalaryReportCurrencies_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportDailyWorkHours",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportDailyWorkHours", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportDailyWorkHours_Value", "\"Value\" IS NULL OR \"Value\" BETWEEN 0 AND 24");
                    table.ForeignKey(
                        name: "FK_SalaryReportDailyWorkHours_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportDisciplines",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportDisciplines", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportDisciplines_Value", "\"Value\" IS NOT NULL AND char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportDisciplines_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportEducations",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportEducations", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportEducations_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportEducations_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportFieldRecommendations",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportFieldRecommendations", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportFieldRecommendations_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportFieldRecommendations_SalaryReports_SalaryReport~",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportHousing",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportHousing", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportHousing_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportHousing_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportMonthlyNetSalaries",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportMonthlyNetSalaries", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportMonthlyNetSalaries_Value", "\"Value\" > 0 AND \"Value\" <= 10000000");
                    table.ForeignKey(
                        name: "FK_SalaryReportMonthlyNetSalaries_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportNegotiationAdvice",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportNegotiationAdvice", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportNegotiationAdvice_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportNegotiationAdvice_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportProfessionalCertificates",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportProfessionalCertificates", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportProfessionalCertificates_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportProfessionalCertificates_SalaryReports_SalaryRe~",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportSalaryFairness",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportSalaryFairness", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportSalaryFairness_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportSalaryFairness_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportSourceRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ExternalRowId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ContentHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SynchronizedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportSourceRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalaryReportSourceRecords_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportTransportation",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportTransportation", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportTransportation_Value", "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportTransportation_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportWorkModes",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportWorkModes", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportWorkModes_Value", "\"Value\" IS NOT NULL AND char_length(btrim(\"Value\")) > 0");
                    table.ForeignKey(
                        name: "FK_SalaryReportWorkModes_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportYearsOfExperience",
                columns: table => new
                {
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryReportYearsOfExperience", x => x.SalaryReportId);
                    table.CheckConstraint("CK_SalaryReportYearsOfExperience_Value", "\"Value\" BETWEEN 0 AND 60");
                    table.ForeignKey(
                        name: "FK_SalaryReportYearsOfExperience_SalaryReports_SalaryReportId",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalarySubmissionIdempotencyRecords",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RequestHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalarySubmissionIdempotencyRecords", x => x.Key);
                    table.ForeignKey(
                        name: "FK_SalarySubmissionIdempotencyRecords_SalaryReports_SalaryRepo~",
                        column: x => x.SalaryReportId,
                        principalTable: "SalaryReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalaryReportReferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SalaryReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReferenceValueId = table.Column<Guid>(type: "uuid", nullable: false),
                    FieldCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false)
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
                name: "IX_SalaryReportAdditionalDaysOff_Value",
                table: "SalaryReportAdditionalDaysOff",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportAnnualBonuses_Value",
                table: "SalaryReportAnnualBonuses",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportCities_Value",
                table: "SalaryReportCities",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportCompanyTypes_Value",
                table: "SalaryReportCompanyTypes",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportCountries_Value",
                table: "SalaryReportCountries",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportCurrencies_Value",
                table: "SalaryReportCurrencies",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportDailyWorkHours_Value",
                table: "SalaryReportDailyWorkHours",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportDisciplines_Value",
                table: "SalaryReportDisciplines",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportEducations_Value",
                table: "SalaryReportEducations",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportFieldRecommendations_Value",
                table: "SalaryReportFieldRecommendations",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportHousing_Value",
                table: "SalaryReportHousing",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportMonthlyNetSalaries_Value",
                table: "SalaryReportMonthlyNetSalaries",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportProfessionalCertificates_Value",
                table: "SalaryReportProfessionalCertificates",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportReferences_ReferenceValueId",
                table: "SalaryReportReferences",
                column: "ReferenceValueId");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportReferences_SalaryReportId_FieldCode",
                table: "SalaryReportReferences",
                columns: new[] { "SalaryReportId", "FieldCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReports_Status_SubmittedAt",
                table: "SalaryReports",
                columns: new[] { "Status", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReports_SubmittedAt",
                table: "SalaryReports",
                column: "SubmittedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportSalaryFairness_Value",
                table: "SalaryReportSalaryFairness",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportSourceRecords_SalaryReportId",
                table: "SalaryReportSourceRecords",
                column: "SalaryReportId");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportSourceRecords_SourceName_ExternalRowId",
                table: "SalaryReportSourceRecords",
                columns: new[] { "SourceName", "ExternalRowId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportTransportation_Value",
                table: "SalaryReportTransportation",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportWorkModes_Value",
                table: "SalaryReportWorkModes",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryReportYearsOfExperience_Value",
                table: "SalaryReportYearsOfExperience",
                column: "Value");

            migrationBuilder.CreateIndex(
                name: "IX_SalarySubmissionIdempotencyRecords_CreatedAt",
                table: "SalarySubmissionIdempotencyRecords",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SalarySubmissionIdempotencyRecords_SalaryReportId",
                table: "SalarySubmissionIdempotencyRecords",
                column: "SalaryReportId",
                unique: true);

            migrationBuilder.Sql("""
                CREATE VIEW "vwSalaryReportReadRows" AS
                SELECT r."Id", d."Value" AS "Discipline", co."Value" AS "Country",
                       ci."Value" AS "City", y."Value" AS "YearsOfExperience",
                       ct."Value" AS "CompanyType", wm."Value" AS "WorkMode",
                       cu."Value" AS "Currency", ms."Value" AS "MonthlyNetSalary",
                       h."Value" AS "HousingProvided", t."Value" AS "TransportationProvided",
                       ab."Value" AS "AnnualBonus", sf."Value" AS "SalaryFairness",
                       fr."Value" AS "RecommendField", na."Value" AS "NegotiationAdvice",
                       pc."Value" AS "ProfessionalCertificate", b."Value" AS "Benefits",
                       e."Value" AS "HighestEducation", dh."Value" AS "DailyWorkHours",
                       ad."Value" AS "ExtraDayOff"
                FROM "SalaryReports" r
                INNER JOIN "SalaryReportDisciplines" d ON d."SalaryReportId" = r."Id"
                INNER JOIN "SalaryReportCountries" co ON co."SalaryReportId" = r."Id"
                INNER JOIN "SalaryReportCities" ci ON ci."SalaryReportId" = r."Id"
                INNER JOIN "SalaryReportYearsOfExperience" y ON y."SalaryReportId" = r."Id"
                INNER JOIN "SalaryReportCompanyTypes" ct ON ct."SalaryReportId" = r."Id"
                INNER JOIN "SalaryReportWorkModes" wm ON wm."SalaryReportId" = r."Id"
                INNER JOIN "SalaryReportCurrencies" cu ON cu."SalaryReportId" = r."Id"
                INNER JOIN "SalaryReportMonthlyNetSalaries" ms ON ms."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportHousing" h ON h."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportTransportation" t ON t."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportAnnualBonuses" ab ON ab."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportSalaryFairness" sf ON sf."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportFieldRecommendations" fr ON fr."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportNegotiationAdvice" na ON na."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportProfessionalCertificates" pc ON pc."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportBenefits" b ON b."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportEducations" e ON e."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportDailyWorkHours" dh ON dh."SalaryReportId" = r."Id"
                LEFT JOIN "SalaryReportAdditionalDaysOff" ad ON ad."SalaryReportId" = r."Id"
                WHERE r."Status" = 'Published';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW IF EXISTS \"vwSalaryReportReadRows\";");

            migrationBuilder.DropTable(
                name: "SalaryReportAdditionalDaysOff");

            migrationBuilder.DropTable(
                name: "SalaryReportAnnualBonuses");

            migrationBuilder.DropTable(
                name: "SalaryReportBenefits");

            migrationBuilder.DropTable(
                name: "SalaryReportCities");

            migrationBuilder.DropTable(
                name: "SalaryReportCompanyTypes");

            migrationBuilder.DropTable(
                name: "SalaryReportCountries");

            migrationBuilder.DropTable(
                name: "SalaryReportCurrencies");

            migrationBuilder.DropTable(
                name: "SalaryReportDailyWorkHours");

            migrationBuilder.DropTable(
                name: "SalaryReportDisciplines");

            migrationBuilder.DropTable(
                name: "SalaryReportEducations");

            migrationBuilder.DropTable(
                name: "SalaryReportFieldRecommendations");

            migrationBuilder.DropTable(
                name: "SalaryReportHousing");

            migrationBuilder.DropTable(
                name: "SalaryReportMonthlyNetSalaries");

            migrationBuilder.DropTable(
                name: "SalaryReportNegotiationAdvice");

            migrationBuilder.DropTable(
                name: "SalaryReportProfessionalCertificates");

            migrationBuilder.DropTable(
                name: "SalaryReportReferences");

            migrationBuilder.DropTable(
                name: "SalaryReportSalaryFairness");

            migrationBuilder.DropTable(
                name: "SalaryReportSourceRecords");

            migrationBuilder.DropTable(
                name: "SalaryReportTransportation");

            migrationBuilder.DropTable(
                name: "SalaryReportWorkModes");

            migrationBuilder.DropTable(
                name: "SalaryReportYearsOfExperience");

            migrationBuilder.DropTable(
                name: "SalarySubmissionIdempotencyRecords");

            migrationBuilder.DropTable(
                name: "ReferenceValues");

            migrationBuilder.DropTable(
                name: "SalaryReports");

            migrationBuilder.DropTable(
                name: "ReferenceCatalogs");
        }
    }
}
