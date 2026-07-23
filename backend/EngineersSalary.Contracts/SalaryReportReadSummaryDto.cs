namespace EngineersSalary.Contracts;

public sealed record SalaryReportReadSummaryDto(
    int TotalReports,
    decimal? AverageMonthlyNetSalary,
    decimal? MinimumMonthlyNetSalary,
    decimal? MaximumMonthlyNetSalary,
    IReadOnlyList<SalaryReportReadBreakdownDto> ByDiscipline,
    IReadOnlyList<SalaryReportReadBreakdownDto> ByCountry,
    IReadOnlyList<SalaryReportReadBreakdownDto> ByExperience);

public sealed record SalaryReportReadBreakdownDto(
    string Value,
    int Count,
    decimal AverageMonthlyNetSalary);
