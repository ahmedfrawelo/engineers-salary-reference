namespace EngineersSalary.Domain;

public sealed class SalaryReport
{
    private SalaryReport() { }

    public SalaryReport(
        string country,
        string city,
        string discipline,
        int yearsOfExperience,
        string companyType,
        string workMode,
        string currency,
        decimal monthlyNetSalary,
        DateOnly submittedAt,
        string? housingProvided = null,
        string? transportationProvided = null,
        string? annualBonus = null,
        string? salaryFairness = null,
        string? recommendField = null,
        string? negotiationAdvice = null,
        string? professionalCertificate = null,
        string? benefits = null,
        string? highestEducation = null,
        decimal? dailyWorkHours = null,
        string? extraDayOff = null)
    {
        Id = Guid.NewGuid();
        SubmittedAt = submittedAt;
        Status = SalaryReportStatus.Published;

        DisciplineField = Text(discipline);
        CountryField = Text(country);
        CityField = Text(city);
        YearsOfExperienceField = new SalaryReportIntegerValue(this, yearsOfExperience);
        CompanyTypeField = Text(companyType);
        WorkModeField = Text(workMode);
        CurrencyField = new SalaryReportCurrencyValue(this, Normalize(currency).ToUpperInvariant());
        MonthlyNetSalaryField = new SalaryReportMonthlyNetSalaryValue(this, monthlyNetSalary);
        HousingProvidedField = OptionalText(housingProvided);
        TransportationProvidedField = OptionalText(transportationProvided);
        AnnualBonusField = OptionalText(annualBonus);
        SalaryFairnessField = OptionalText(salaryFairness);
        RecommendFieldValue = OptionalText(recommendField);
        NegotiationAdviceField = OptionalText(negotiationAdvice);
        ProfessionalCertificateField = OptionalText(professionalCertificate);
        BenefitsField = OptionalText(benefits);
        HighestEducationField = OptionalText(highestEducation);
        DailyWorkHoursField = new SalaryReportDecimalValue(this, dailyWorkHours);
        ExtraDayOffField = OptionalText(extraDayOff);
    }

    public Guid Id { get; private set; }
    public DateOnly SubmittedAt { get; private set; }
    public SalaryReportStatus Status { get; private set; }

    public SalaryReportTextValue DisciplineField { get; private set; } = null!;
    public SalaryReportTextValue CountryField { get; private set; } = null!;
    public SalaryReportTextValue CityField { get; private set; } = null!;
    public SalaryReportIntegerValue YearsOfExperienceField { get; private set; } = null!;
    public SalaryReportTextValue CompanyTypeField { get; private set; } = null!;
    public SalaryReportTextValue WorkModeField { get; private set; } = null!;
    public SalaryReportCurrencyValue CurrencyField { get; private set; } = null!;
    public SalaryReportMonthlyNetSalaryValue MonthlyNetSalaryField { get; private set; } = null!;
    public SalaryReportTextValue HousingProvidedField { get; private set; } = null!;
    public SalaryReportTextValue TransportationProvidedField { get; private set; } = null!;
    public SalaryReportTextValue AnnualBonusField { get; private set; } = null!;
    public SalaryReportTextValue SalaryFairnessField { get; private set; } = null!;
    public SalaryReportTextValue RecommendFieldValue { get; private set; } = null!;
    public SalaryReportTextValue NegotiationAdviceField { get; private set; } = null!;
    public SalaryReportTextValue ProfessionalCertificateField { get; private set; } = null!;
    public SalaryReportTextValue BenefitsField { get; private set; } = null!;
    public SalaryReportTextValue HighestEducationField { get; private set; } = null!;
    public SalaryReportDecimalValue DailyWorkHoursField { get; private set; } = null!;
    public SalaryReportTextValue ExtraDayOffField { get; private set; } = null!;

    public string Discipline => Required(DisciplineField);
    public string CompanyType => Required(CompanyTypeField);
    public string City => Required(CityField);
    public string Country => Required(CountryField);
    public decimal MonthlyNetSalary => MonthlyNetSalaryField.Value;
    public string Currency => CurrencyField.Value;
    public int YearsOfExperience => YearsOfExperienceField.Value;
    public string WorkMode => Required(WorkModeField);
    public string? Benefits => BenefitsField.Value;
    public string? HousingProvided => HousingProvidedField.Value;
    public string? TransportationProvided => TransportationProvidedField.Value;
    public string? AnnualBonus => AnnualBonusField.Value;
    public string? SalaryFairness => SalaryFairnessField.Value;
    public string? RecommendField => RecommendFieldValue.Value;
    public string? NegotiationAdvice => NegotiationAdviceField.Value;
    public string? ProfessionalCertificate => ProfessionalCertificateField.Value;
    public string? HighestEducation => HighestEducationField.Value;
    public decimal? DailyWorkHours => DailyWorkHoursField.Value;
    public string? ExtraDayOff => ExtraDayOffField.Value;

    public void Publish() => Status = SalaryReportStatus.Published;

    public void Hide() => Status = SalaryReportStatus.Hidden;

    public void RefreshImportedValues(
        string discipline,
        string companyType,
        string city,
        string country,
        decimal monthlyNetSalary,
        string currency,
        int yearsOfExperience,
        string workMode,
        string? benefits,
        string? housingProvided,
        string? transportationProvided,
        string? annualBonus,
        string? salaryFairness,
        string? recommendField,
        string? negotiationAdvice,
        string? professionalCertificate,
        string? highestEducation,
        decimal? dailyWorkHours,
        string? extraDayOff)
    {
        DisciplineField.Set(Normalize(discipline));
        CompanyTypeField.Set(Normalize(companyType));
        CityField.Set(Normalize(city));
        CountryField.Set(Normalize(country));
        CurrencyField.Set(Normalize(currency).ToUpperInvariant());
        MonthlyNetSalaryField.Set(monthlyNetSalary);
        YearsOfExperienceField.Set(yearsOfExperience);
        WorkModeField.Set(Normalize(workMode));
        BenefitsField.Set(NormalizeOptional(benefits));
        HousingProvidedField.Set(NormalizeOptional(housingProvided));
        TransportationProvidedField.Set(NormalizeOptional(transportationProvided));
        AnnualBonusField.Set(NormalizeOptional(annualBonus));
        SalaryFairnessField.Set(NormalizeOptional(salaryFairness));
        RecommendFieldValue.Set(NormalizeOptional(recommendField));
        NegotiationAdviceField.Set(NormalizeOptional(negotiationAdvice));
        ProfessionalCertificateField.Set(NormalizeOptional(professionalCertificate));
        HighestEducationField.Set(NormalizeOptional(highestEducation));
        DailyWorkHoursField.Set(dailyWorkHours);
        ExtraDayOffField.Set(NormalizeOptional(extraDayOff));
    }

    private SalaryReportTextValue Text(string value) => new(this, Normalize(value));

    private SalaryReportTextValue OptionalText(string? value) => new(this, NormalizeOptional(value));

    private static string Required(SalaryReportTextValue field) => field.Value ?? string.Empty;

    private static string Normalize(string value) => value.Trim();

    private static string? NormalizeOptional(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }
}
