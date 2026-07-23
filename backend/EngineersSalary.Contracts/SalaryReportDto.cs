namespace EngineersSalary.Contracts;

public sealed record SalaryReportDto(
    Guid Id,
    string Country,
    string City,
    string Discipline,
    string CompanyType,
    int YearsOfExperience,
    string WorkMode,
    string Currency,
    decimal MonthlyNetSalary,
    DateOnly SubmittedAt,
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
