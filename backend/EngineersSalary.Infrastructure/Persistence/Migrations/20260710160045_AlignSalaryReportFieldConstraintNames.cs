using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AlignSalaryReportFieldConstraintNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DECLARE @Tables TABLE (Name sysname NOT NULL);
                INSERT @Tables(Name) VALUES
                    ('SalaryReportAdditionalDaysOff'), ('SalaryReportAnnualBonuses'),
                    ('SalaryReportBenefits'), ('SalaryReportCities'), ('SalaryReportCompanyTypes'),
                    ('SalaryReportCompensations'), ('SalaryReportCountries'),
                    ('SalaryReportDailyWorkHours'), ('SalaryReportDisciplines'),
                    ('SalaryReportEducations'), ('SalaryReportFieldRecommendations'),
                    ('SalaryReportHousing'), ('SalaryReportNegotiationAdvice'), ('SalaryReportNotes'),
                    ('SalaryReportProfessionalCertificates'), ('SalaryReportSalaryFairness'),
                    ('SalaryReportTransportation'), ('SalaryReportWorkModes'),
                    ('SalaryReportYearsOfExperience');

                DECLARE @TableName sysname, @ConstraintName sysname, @QualifiedName nvarchar(517), @TargetName sysname;
                DECLARE constraint_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT Name FROM @Tables;
                OPEN constraint_cursor;
                FETCH NEXT FROM constraint_cursor INTO @TableName;
                WHILE @@FETCH_STATUS = 0
                BEGIN
                    SELECT @ConstraintName = kc.name
                    FROM sys.key_constraints kc
                    WHERE kc.parent_object_id = OBJECT_ID(N'dbo.' + @TableName) AND kc.type = 'PK';
                    SET @TargetName = N'PK_' + @TableName;
                    IF @ConstraintName IS NOT NULL AND @ConstraintName <> @TargetName
                    BEGIN
                        SET @QualifiedName = N'dbo.' + QUOTENAME(@ConstraintName);
                        EXEC sys.sp_rename @QualifiedName, @TargetName, N'OBJECT';
                    END;

                    SELECT @ConstraintName = fk.name
                    FROM sys.foreign_keys fk
                    WHERE fk.parent_object_id = OBJECT_ID(N'dbo.' + @TableName)
                      AND fk.referenced_object_id = OBJECT_ID(N'dbo.SalaryReports');
                    SET @TargetName = N'FK_' + @TableName + N'_SalaryReports_SalaryReportId';
                    IF @ConstraintName IS NOT NULL AND @ConstraintName <> @TargetName
                    BEGIN
                        SET @QualifiedName = N'dbo.' + QUOTENAME(@ConstraintName);
                        EXEC sys.sp_rename @QualifiedName, @TargetName, N'OBJECT';
                    END;

                    FETCH NEXT FROM constraint_cursor INTO @TableName;
                END;
                CLOSE constraint_cursor;
                DEALLOCATE constraint_cursor;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DECLARE @Tables TABLE (Name sysname NOT NULL);
                INSERT @Tables(Name) VALUES
                    ('SalaryReportAdditionalDaysOff'), ('SalaryReportAnnualBonuses'),
                    ('SalaryReportBenefits'), ('SalaryReportCities'), ('SalaryReportCompanyTypes'),
                    ('SalaryReportCompensations'), ('SalaryReportCountries'),
                    ('SalaryReportDailyWorkHours'), ('SalaryReportDisciplines'),
                    ('SalaryReportEducations'), ('SalaryReportFieldRecommendations'),
                    ('SalaryReportHousing'), ('SalaryReportNegotiationAdvice'), ('SalaryReportNotes'),
                    ('SalaryReportProfessionalCertificates'), ('SalaryReportSalaryFairness'),
                    ('SalaryReportTransportation'), ('SalaryReportWorkModes'),
                    ('SalaryReportYearsOfExperience');

                DECLARE @TableName sysname, @CurrentName sysname, @QualifiedName nvarchar(517), @TargetName sysname;
                DECLARE constraint_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT Name FROM @Tables;
                OPEN constraint_cursor;
                FETCH NEXT FROM constraint_cursor INTO @TableName;
                WHILE @@FETCH_STATUS = 0
                BEGIN
                    SET @CurrentName = N'FK_' + @TableName + N'_SalaryReports_SalaryReportId';
                    SET @TargetName = N'FK_' + @TableName + N'_SalaryReports';
                    IF OBJECT_ID(N'dbo.' + @CurrentName) IS NOT NULL
                    BEGIN
                        SET @QualifiedName = N'dbo.' + QUOTENAME(@CurrentName);
                        EXEC sys.sp_rename @QualifiedName, @TargetName, N'OBJECT';
                    END;

                    SET @CurrentName = N'PK_' + @TableName;
                    SET @TargetName = N'PK_Legacy_' + @TableName;
                    IF OBJECT_ID(N'dbo.' + @CurrentName) IS NOT NULL
                    BEGIN
                        SET @QualifiedName = N'dbo.' + QUOTENAME(@CurrentName);
                        EXEC sys.sp_rename @QualifiedName, @TargetName, N'OBJECT';
                    END;

                    FETCH NEXT FROM constraint_cursor INTO @TableName;
                END;
                CLOSE constraint_cursor;
                DEALLOCATE constraint_cursor;
                """);
        }
    }
}
