namespace EngineersSalary.Contracts;

public sealed record SalaryOptionsDto(
    IReadOnlyList<string> Disciplines,
    IReadOnlyList<string> CompanyTypes,
    IReadOnlyList<string> Cities,
    IReadOnlyList<string> Countries,
    IReadOnlyList<string> WorkModes,
    IReadOnlyList<string> Currencies,
    IReadOnlyList<string> HousingProvided,
    IReadOnlyList<string> TransportationProvided,
    IReadOnlyList<string> AnnualBonuses,
    IReadOnlyList<string> SalaryFairnessOptions,
    IReadOnlyList<string> RecommendFieldOptions,
    IReadOnlyList<string> ProfessionalCertificates,
    IReadOnlyList<string> HighestEducations,
    IReadOnlyList<string> ExtraDaysOff,
    IReadOnlyList<decimal> MonthlyNetSalaries,
    IReadOnlyList<int> YearsOfExperience,
    IReadOnlyList<decimal> DailyWorkHours);
