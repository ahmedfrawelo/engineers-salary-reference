using EngineersSalary.Domain;

namespace EngineersSalary.Tests;

public sealed class SalaryReportTests
{
    [Fact]
    public void Constructor_normalizes_required_and_optional_fields()
    {
        var report = Report(
            discipline: "  Mechanical  ",
            benefits: "  KPI + medical  ",
            negotiationAdvice: "  Use market evidence  ");

        Assert.Equal("Mechanical", report.Discipline);
        Assert.Equal("KPI + medical", report.Benefits);
        Assert.Equal("Use market evidence", report.NegotiationAdvice);
        Assert.Equal("EGP", report.Currency);
        Assert.Equal(SalaryReportStatus.Published, report.Status);
    }

    [Fact]
    public void Hide_and_publish_manage_moderation_state()
    {
        var report = Report();

        report.Hide();
        Assert.Equal(SalaryReportStatus.Hidden, report.Status);

        report.Publish();
        Assert.Equal(SalaryReportStatus.Published, report.Status);
    }

    [Fact]
    public void Field_entities_keep_bidirectional_relationships_to_the_report()
    {
        var report = Report(benefits: "Medical", negotiationAdvice: "Context");
        var fields = new object[]
        {
            report.DisciplineField, report.CountryField, report.CityField,
            report.YearsOfExperienceField, report.CompanyTypeField, report.WorkModeField,
            report.CurrencyField, report.MonthlyNetSalaryField,
            report.HousingProvidedField, report.TransportationProvidedField,
            report.AnnualBonusField, report.SalaryFairnessField, report.RecommendFieldValue,
            report.NegotiationAdviceField, report.ProfessionalCertificateField,
            report.BenefitsField, report.HighestEducationField, report.DailyWorkHoursField,
            report.ExtraDayOffField
        };

        Assert.Equal(19, fields.Length);
        Assert.All(fields, field =>
        {
            var owner = field.GetType().GetProperty(nameof(SalaryReportTextValue.SalaryReport))?.GetValue(field);
            Assert.Same(report, owner);
        });
    }

    private static SalaryReport Report(
        string discipline = "Civil",
        string? benefits = null,
        string? negotiationAdvice = null)
    {
        return new SalaryReport(
            "Egypt",
            "Cairo",
            discipline,
            2,
            "Consultant",
            "Site",
            " egp ",
            12_000,
            DateOnly.FromDateTime(DateTime.UtcNow),
            negotiationAdvice: negotiationAdvice,
            benefits: benefits);
    }
}
