using EngineersSalary.Application;
using EngineersSalary.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EngineersSalary.Infrastructure;

public sealed class EngineersSalaryDbContext(DbContextOptions<EngineersSalaryDbContext> options)
    : DbContext(options)
{
    public DbSet<SalaryReport> SalaryReports => Set<SalaryReport>();
    public DbSet<SalaryReportSourceRecord> SalaryReportSourceRecords => Set<SalaryReportSourceRecord>();
    public DbSet<ReferenceCatalog> ReferenceCatalogs => Set<ReferenceCatalog>();
    public DbSet<ReferenceValue> ReferenceValues => Set<ReferenceValue>();
    public DbSet<SalaryReportReference> SalaryReportReferences => Set<SalaryReportReference>();
    public DbSet<SalarySubmissionIdempotencyRecord> SalarySubmissionIdempotencyRecords => Set<SalarySubmissionIdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var isPostgreSql = Database.IsNpgsql();
        modelBuilder.Entity<SalaryReport>(entity =>
        {
            entity.ToTable("SalaryReports", table => table.HasCheckConstraint(
                "CK_SalaryReports_Status",
                isPostgreSql
                    ? "\"Status\" IN ('Draft', 'Published', 'Hidden')"
                    : "[Status] IN ('Draft', 'Published', 'Hidden')"));
            entity.HasKey(report => report.Id);
            entity.Property(report => report.Status).HasConversion<string>().HasMaxLength(40);
            entity.HasIndex(report => report.SubmittedAt);
            entity.HasIndex(report => new { report.Status, report.SubmittedAt });

            entity.Ignore(report => report.Discipline);
            entity.Ignore(report => report.CompanyType);
            entity.Ignore(report => report.City);
            entity.Ignore(report => report.Country);
            entity.Ignore(report => report.MonthlyNetSalary);
            entity.Ignore(report => report.Currency);
            entity.Ignore(report => report.YearsOfExperience);
            entity.Ignore(report => report.WorkMode);
            entity.Ignore(report => report.Benefits);
            entity.Ignore(report => report.HousingProvided);
            entity.Ignore(report => report.TransportationProvided);
            entity.Ignore(report => report.AnnualBonus);
            entity.Ignore(report => report.SalaryFairness);
            entity.Ignore(report => report.RecommendField);
            entity.Ignore(report => report.NegotiationAdvice);
            entity.Ignore(report => report.ProfessionalCertificate);
            entity.Ignore(report => report.HighestEducation);
            entity.Ignore(report => report.DailyWorkHours);
            entity.Ignore(report => report.ExtraDayOff);

            entity.OwnsOne(report => report.DisciplineField, owned => ConfigureTextField(owned, "SalaryReportDisciplines", 120, true, true, isPostgreSql));
            entity.OwnsOne(report => report.CountryField, owned => ConfigureTextField(owned, "SalaryReportCountries", 100, true, true, isPostgreSql));
            entity.OwnsOne(report => report.CityField, owned => ConfigureTextField(owned, "SalaryReportCities", 100, true, true, isPostgreSql));
            entity.OwnsOne(report => report.CompanyTypeField, owned => ConfigureTextField(owned, "SalaryReportCompanyTypes", 120, true, true, isPostgreSql));
            entity.OwnsOne(report => report.WorkModeField, owned => ConfigureTextField(owned, "SalaryReportWorkModes", 80, true, true, isPostgreSql));
            entity.OwnsOne(report => report.HousingProvidedField, owned => ConfigureTextField(owned, "SalaryReportHousing", 80, false, true, isPostgreSql));
            entity.OwnsOne(report => report.TransportationProvidedField, owned => ConfigureTextField(owned, "SalaryReportTransportation", 80, false, true, isPostgreSql));
            entity.OwnsOne(report => report.AnnualBonusField, owned => ConfigureTextField(owned, "SalaryReportAnnualBonuses", 80, false, true, isPostgreSql));
            entity.OwnsOne(report => report.SalaryFairnessField, owned => ConfigureTextField(owned, "SalaryReportSalaryFairness", 80, false, true, isPostgreSql));
            entity.OwnsOne(report => report.RecommendFieldValue, owned => ConfigureTextField(owned, "SalaryReportFieldRecommendations", 80, false, true, isPostgreSql));
            entity.OwnsOne(report => report.NegotiationAdviceField, owned => ConfigureTextField(owned, "SalaryReportNegotiationAdvice", 1000, false, false, isPostgreSql));
            entity.OwnsOne(report => report.ProfessionalCertificateField, owned => ConfigureTextField(owned, "SalaryReportProfessionalCertificates", 120, false, true, isPostgreSql));
            entity.OwnsOne(report => report.BenefitsField, owned => ConfigureTextField(owned, "SalaryReportBenefits", 600, false, false, isPostgreSql));
            entity.OwnsOne(report => report.HighestEducationField, owned => ConfigureTextField(owned, "SalaryReportEducations", 120, false, true, isPostgreSql));
            entity.OwnsOne(report => report.ExtraDayOffField, owned => ConfigureTextField(owned, "SalaryReportAdditionalDaysOff", 80, false, true, isPostgreSql));

            entity.OwnsOne(report => report.YearsOfExperienceField, owned =>
            {
                owned.ToTable("SalaryReportYearsOfExperience", table => table.HasCheckConstraint(
                    "CK_SalaryReportYearsOfExperience_Value",
                    isPostgreSql ? "\"Value\" BETWEEN 0 AND 60" : "[Value] BETWEEN 0 AND 60"));
                owned.WithOwner(value => value.SalaryReport).HasForeignKey(value => value.SalaryReportId);
                owned.HasKey(value => value.SalaryReportId);
                owned.Property(value => value.Value).IsRequired();
                owned.HasIndex(value => value.Value).HasDatabaseName("IX_SalaryReportYearsOfExperience_Value");
            });
            entity.OwnsOne(report => report.DailyWorkHoursField, owned =>
            {
                owned.ToTable("SalaryReportDailyWorkHours", table => table.HasCheckConstraint(
                    "CK_SalaryReportDailyWorkHours_Value",
                    isPostgreSql ? "\"Value\" IS NULL OR \"Value\" BETWEEN 0 AND 24" : "[Value] IS NULL OR [Value] BETWEEN 0 AND 24"));
                owned.WithOwner(value => value.SalaryReport).HasForeignKey(value => value.SalaryReportId);
                owned.HasKey(value => value.SalaryReportId);
                owned.Property(value => value.Value).HasPrecision(5, 2);
                owned.HasIndex(value => value.Value).HasDatabaseName("IX_SalaryReportDailyWorkHours_Value");
            });
            entity.OwnsOne(report => report.CurrencyField, owned =>
            {
                owned.ToTable("SalaryReportCurrencies", table => table.HasCheckConstraint(
                    "CK_SalaryReportCurrencies_Value",
                    isPostgreSql ? "char_length(btrim(\"Value\")) BETWEEN 1 AND 8" : "LEN(LTRIM(RTRIM([Value]))) BETWEEN 1 AND 8"));
                owned.WithOwner(value => value.SalaryReport).HasForeignKey(value => value.SalaryReportId);
                owned.HasKey(value => value.SalaryReportId);
                owned.Property(value => value.Value).HasMaxLength(8).IsRequired();
                owned.HasIndex(value => value.Value).HasDatabaseName("IX_SalaryReportCurrencies_Value");
            });
            entity.OwnsOne(report => report.MonthlyNetSalaryField, owned =>
            {
                owned.ToTable("SalaryReportMonthlyNetSalaries", table => table.HasCheckConstraint(
                    "CK_SalaryReportMonthlyNetSalaries_Value",
                    isPostgreSql ? "\"Value\" > 0 AND \"Value\" <= 10000000" : "[Value] > 0 AND [Value] <= 10000000"));
                owned.WithOwner(value => value.SalaryReport).HasForeignKey(value => value.SalaryReportId);
                owned.HasKey(value => value.SalaryReportId);
                owned.Property(value => value.Value).HasPrecision(18, 2).IsRequired();
                owned.HasIndex(value => value.Value).HasDatabaseName("IX_SalaryReportMonthlyNetSalaries_Value");
            });
        });

        modelBuilder.Entity<SalaryReportSourceRecord>(entity =>
        {
            entity.ToTable("SalaryReportSourceRecords");
            entity.HasKey(source => source.Id);
            entity.Property(source => source.SourceName).HasMaxLength(80).IsRequired();
            entity.Property(source => source.ExternalRowId).HasMaxLength(80).IsRequired();
            entity.Property(source => source.ContentHash).HasMaxLength(64).IsRequired();
            entity.HasIndex(source => new { source.SourceName, source.ExternalRowId }).IsUnique();
            entity.HasOne(source => source.SalaryReport)
                .WithMany()
                .HasForeignKey(source => source.SalaryReportId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ReferenceCatalog>(entity =>
        {
            entity.ToTable("ReferenceCatalogs");
            entity.HasKey(catalog => catalog.Id);
            entity.Property(catalog => catalog.Code).HasMaxLength(80).IsRequired();
            entity.Property(catalog => catalog.Label).HasMaxLength(120).IsRequired();
            entity.HasIndex(catalog => catalog.Code).IsUnique();
        });
        modelBuilder.Entity<ReferenceValue>(entity =>
        {
            entity.ToTable("ReferenceValues");
            entity.HasKey(value => value.Id);
            entity.Property(value => value.Value).HasMaxLength(180).IsRequired();
            entity.Property(value => value.NormalizedValue).HasMaxLength(180).IsRequired();
            entity.HasIndex(value => new { value.CatalogId, value.NormalizedValue }).IsUnique();
            entity.HasOne(value => value.Catalog).WithMany(catalog => catalog.Values).HasForeignKey(value => value.CatalogId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(value => value.ParentValue).WithMany().HasForeignKey(value => value.ParentValueId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<SalaryReportReference>(entity =>
        {
            entity.ToTable("SalaryReportReferences");
            entity.HasKey(reference => reference.Id);
            entity.Property(reference => reference.FieldCode).HasMaxLength(80).IsRequired();
            entity.HasIndex(reference => new { reference.SalaryReportId, reference.FieldCode }).IsUnique();
            entity.HasIndex(reference => reference.ReferenceValueId);
            entity.HasOne(reference => reference.SalaryReport).WithMany().HasForeignKey(reference => reference.SalaryReportId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(reference => reference.ReferenceValue).WithMany().HasForeignKey(reference => reference.ReferenceValueId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<SalarySubmissionIdempotencyRecord>(entity =>
        {
            entity.ToTable("SalarySubmissionIdempotencyRecords");
            entity.HasKey(record => record.Key);
            entity.Property(record => record.Key).HasMaxLength(100);
            entity.Property(record => record.RequestHash).HasMaxLength(64).IsRequired();
            entity.HasIndex(record => record.SalaryReportId).IsUnique();
            entity.HasIndex(record => record.CreatedAt);
            entity.HasOne(record => record.SalaryReport)
                .WithOne()
                .HasForeignKey<SalarySubmissionIdempotencyRecord>(record => record.SalaryReportId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureTextField(
        OwnedNavigationBuilder<SalaryReport, SalaryReportTextValue> owned,
        string tableName,
        int maximumLength,
        bool required,
        bool indexed,
        bool isPostgreSql)
    {
        owned.ToTable(tableName, table => table.HasCheckConstraint(
            $"CK_{tableName}_Value",
            isPostgreSql
                ? required
                    ? "\"Value\" IS NOT NULL AND char_length(btrim(\"Value\")) > 0"
                    : "\"Value\" IS NULL OR char_length(btrim(\"Value\")) > 0"
                : required
                    ? "[Value] IS NOT NULL AND LEN(LTRIM(RTRIM([Value]))) > 0"
                    : "[Value] IS NULL OR LEN(LTRIM(RTRIM([Value]))) > 0"));
        owned.WithOwner(value => value.SalaryReport).HasForeignKey(value => value.SalaryReportId);
        owned.HasKey(value => value.SalaryReportId);
        var property = owned.Property(value => value.Value).HasMaxLength(maximumLength);
        if (required) property.IsRequired();
        if (indexed) owned.HasIndex(value => value.Value).HasDatabaseName($"IX_{tableName}_Value");
    }
}
