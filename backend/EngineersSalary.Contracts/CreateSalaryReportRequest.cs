namespace EngineersSalary.Contracts;

public sealed record CreateSalaryReportRequest(
    string Country,
    string City,
    string Discipline,
    int YearsOfExperience,
    string CompanyType,
    string WorkMode,
    string Currency,
    decimal MonthlyNetSalary,
    string? HousingProvided,
    string? TransportationProvided,
    string? AnnualBonus,
    string? SalaryFairness,
    string? RecommendField,
    string? NegotiationAdvice,
    string? ProfessionalCertificate,
    string? Benefits,
    string? HighestEducation,
    decimal? DailyWorkHours,
    string? ExtraDayOff);
