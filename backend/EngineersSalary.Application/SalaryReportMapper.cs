using EngineersSalary.Contracts;
using EngineersSalary.Domain;

namespace EngineersSalary.Application;

internal static class SalaryReportMapper
{
    public static SalaryReportDto ToDto(this SalaryReport report)
    {
        return new SalaryReportDto(
            report.Id,
            report.Country,
            report.City,
            report.Discipline,
            report.CompanyType,
            report.YearsOfExperience,
            report.WorkMode,
            report.Currency,
            report.MonthlyNetSalary,
            report.SubmittedAt,
            report.HousingProvided,
            report.TransportationProvided,
            report.AnnualBonus,
            report.SalaryFairness,
            report.RecommendField,
            report.NegotiationAdvice,
            report.ProfessionalCertificate,
            report.Benefits,
            report.HighestEducation,
            report.DailyWorkHours,
            report.ExtraDayOff);
    }
}
