namespace EngineersSalary.Contracts;

public sealed record SalaryReportReadRowDto(
    Guid Id,
    string Discipline,
    string Country,
    string City,
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

public sealed record SalaryReportReadRowPageDto(
    IReadOnlyList<SalaryReportReadRowDto> Items,
    int TotalCount,
    int PageNumber,
    int PageSize,
    int TotalPages);
