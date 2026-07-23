using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EngineersSalary.Infrastructure.Persistence.Migrations;

public partial class NormalizeSalaryReportFieldOwnership : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TRIGGER IF EXISTS dbo.TR_SalaryReports_SynchronizeFields;
            DROP INDEX IF EXISTS IX_SalaryReports_Discipline_Seniority_City ON dbo.SalaryReports;
            DROP INDEX IF EXISTS IX_SalaryReports_Status_Discipline_Seniority ON dbo.SalaryReports;
            DROP INDEX IF EXISTS IX_SalaryReports_Status_WorkMode ON dbo.SalaryReports;

            ALTER TABLE dbo.SalaryReports DROP COLUMN
                AnnualBonus, Benefits, City, CompanyName, CompanyType, Country, Currency,
                DailyWorkHours, Discipline, EmploymentType, ExtraDayOff, HighestEducation,
                HousingProvided, MonthlyNetSalary, NegotiationAdvice, Notes,
                ProfessionalCertificate, RecommendField, RoleTitle, SalaryFairness, Seniority,
                TransportationProvided, WorkMode, YearsOfExperience;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE dbo.SalaryReports ADD
                AnnualBonus nvarchar(80) NULL,
                Benefits nvarchar(600) NULL,
                City nvarchar(100) NULL,
                CompanyName nvarchar(180) NULL,
                CompanyType nvarchar(120) NULL,
                Country nvarchar(100) NULL,
                Currency nvarchar(8) NULL,
                DailyWorkHours decimal(5,2) NULL,
                Discipline nvarchar(120) NULL,
                EmploymentType nvarchar(80) NULL,
                ExtraDayOff nvarchar(80) NULL,
                HighestEducation nvarchar(120) NULL,
                HousingProvided nvarchar(80) NULL,
                MonthlyNetSalary decimal(18,2) NULL,
                NegotiationAdvice nvarchar(1000) NULL,
                Notes nvarchar(1000) NULL,
                ProfessionalCertificate nvarchar(120) NULL,
                RecommendField nvarchar(80) NULL,
                RoleTitle nvarchar(160) NULL,
                SalaryFairness nvarchar(80) NULL,
                Seniority nvarchar(80) NULL,
                TransportationProvided nvarchar(80) NULL,
                WorkMode nvarchar(80) NULL,
                YearsOfExperience int NULL;

            UPDATE r SET
                AnnualBonus = ab.Value,
                Benefits = b.Value,
                City = ci.Value,
                CompanyName = N'Anonymous company',
                CompanyType = ct.Value,
                Country = co.Value,
                Currency = cp.Currency,
                DailyWorkHours = dh.Value,
                Discipline = d.Value,
                EmploymentType = N'Not specified',
                ExtraDayOff = ad.Value,
                HighestEducation = e.Value,
                HousingProvided = h.Value,
                MonthlyNetSalary = cp.MonthlyNetSalary,
                NegotiationAdvice = na.Value,
                Notes = n.Value,
                ProfessionalCertificate = pc.Value,
                RecommendField = fr.Value,
                RoleTitle = d.Value,
                SalaryFairness = sf.Value,
                Seniority = CONCAT(y.Value, N' years'),
                TransportationProvided = t.Value,
                WorkMode = wm.Value,
                YearsOfExperience = y.Value
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
            LEFT JOIN dbo.SalaryReportNotes n ON n.SalaryReportId = r.Id;

            ALTER TABLE dbo.SalaryReports ALTER COLUMN City nvarchar(100) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN CompanyName nvarchar(180) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN CompanyType nvarchar(120) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN Country nvarchar(100) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN Currency nvarchar(8) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN Discipline nvarchar(120) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN EmploymentType nvarchar(80) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN MonthlyNetSalary decimal(18,2) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN RoleTitle nvarchar(160) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN Seniority nvarchar(80) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN WorkMode nvarchar(80) NOT NULL;
            ALTER TABLE dbo.SalaryReports ALTER COLUMN YearsOfExperience int NOT NULL;

            CREATE INDEX IX_SalaryReports_Discipline_Seniority_City ON dbo.SalaryReports(Discipline, Seniority, City);
            CREATE INDEX IX_SalaryReports_Status_Discipline_Seniority ON dbo.SalaryReports(Status, Discipline, Seniority);
            CREATE INDEX IX_SalaryReports_Status_WorkMode ON dbo.SalaryReports(Status, WorkMode);

            EXEC('CREATE TRIGGER dbo.TR_SalaryReports_SynchronizeFields ON dbo.SalaryReports AFTER INSERT, UPDATE AS BEGIN
                SET NOCOUNT ON;
                DELETE c FROM dbo.SalaryReportCountries c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportCities c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportDisciplines c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportYearsOfExperience c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportCompanyTypes c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportWorkModes c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportCompensations c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportHousing c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportTransportation c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportAnnualBonuses c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportSalaryFairness c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportFieldRecommendations c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportNegotiationAdvice c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportProfessionalCertificates c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportBenefits c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportEducations c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportDailyWorkHours c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportAdditionalDaysOff c INNER JOIN inserted i ON i.Id = c.SalaryReportId;
                DELETE c FROM dbo.SalaryReportNotes c INNER JOIN inserted i ON i.Id = c.SalaryReportId;

                INSERT dbo.SalaryReportCountries SELECT Id, Country FROM inserted;
                INSERT dbo.SalaryReportCities SELECT Id, City FROM inserted;
                INSERT dbo.SalaryReportDisciplines SELECT Id, Discipline FROM inserted;
                INSERT dbo.SalaryReportYearsOfExperience SELECT Id, YearsOfExperience FROM inserted;
                INSERT dbo.SalaryReportCompanyTypes SELECT Id, CompanyType FROM inserted;
                INSERT dbo.SalaryReportWorkModes SELECT Id, WorkMode FROM inserted;
                INSERT dbo.SalaryReportCompensations SELECT Id, Currency, MonthlyNetSalary FROM inserted;
                INSERT dbo.SalaryReportHousing SELECT Id, HousingProvided FROM inserted;
                INSERT dbo.SalaryReportTransportation SELECT Id, TransportationProvided FROM inserted;
                INSERT dbo.SalaryReportAnnualBonuses SELECT Id, AnnualBonus FROM inserted;
                INSERT dbo.SalaryReportSalaryFairness SELECT Id, SalaryFairness FROM inserted;
                INSERT dbo.SalaryReportFieldRecommendations SELECT Id, RecommendField FROM inserted;
                INSERT dbo.SalaryReportNegotiationAdvice SELECT Id, NegotiationAdvice FROM inserted;
                INSERT dbo.SalaryReportProfessionalCertificates SELECT Id, ProfessionalCertificate FROM inserted;
                INSERT dbo.SalaryReportBenefits SELECT Id, Benefits FROM inserted;
                INSERT dbo.SalaryReportEducations SELECT Id, HighestEducation FROM inserted;
                INSERT dbo.SalaryReportDailyWorkHours SELECT Id, DailyWorkHours FROM inserted;
                INSERT dbo.SalaryReportAdditionalDaysOff SELECT Id, ExtraDayOff FROM inserted;
                INSERT dbo.SalaryReportNotes SELECT Id, Notes FROM inserted;
            END');
            """);
    }
}
