namespace EngineersSalary.Domain;

public sealed class SalaryReportTextValue
{
    private SalaryReportTextValue() { }

    internal SalaryReportTextValue(SalaryReport salaryReport, string? value)
    {
        SalaryReport = salaryReport;
        SalaryReportId = salaryReport.Id;
        Value = value;
    }

    public Guid SalaryReportId { get; private set; }
    public SalaryReport SalaryReport { get; private set; } = null!;
    public string? Value { get; private set; }

    internal void Set(string? value) => Value = value;
}

public sealed class SalaryReportIntegerValue
{
    private SalaryReportIntegerValue() { }

    internal SalaryReportIntegerValue(SalaryReport salaryReport, int value)
    {
        SalaryReport = salaryReport;
        SalaryReportId = salaryReport.Id;
        Value = value;
    }

    public Guid SalaryReportId { get; private set; }
    public SalaryReport SalaryReport { get; private set; } = null!;
    public int Value { get; private set; }

    internal void Set(int value) => Value = value;
}

public sealed class SalaryReportDecimalValue
{
    private SalaryReportDecimalValue() { }

    internal SalaryReportDecimalValue(SalaryReport salaryReport, decimal? value)
    {
        SalaryReport = salaryReport;
        SalaryReportId = salaryReport.Id;
        Value = value;
    }

    public Guid SalaryReportId { get; private set; }
    public SalaryReport SalaryReport { get; private set; } = null!;
    public decimal? Value { get; private set; }

    internal void Set(decimal? value) => Value = value;
}

public sealed class SalaryReportCurrencyValue
{
    private SalaryReportCurrencyValue() { }

    internal SalaryReportCurrencyValue(SalaryReport salaryReport, string value)
    {
        SalaryReport = salaryReport;
        SalaryReportId = salaryReport.Id;
        Value = value;
    }

    public Guid SalaryReportId { get; private set; }
    public SalaryReport SalaryReport { get; private set; } = null!;
    public string Value { get; private set; } = "EGP";

    internal void Set(string value) => Value = value;
}

public sealed class SalaryReportMonthlyNetSalaryValue
{
    private SalaryReportMonthlyNetSalaryValue() { }

    internal SalaryReportMonthlyNetSalaryValue(SalaryReport salaryReport, decimal value)
    {
        SalaryReport = salaryReport;
        SalaryReportId = salaryReport.Id;
        Value = value;
    }

    public Guid SalaryReportId { get; private set; }
    public SalaryReport SalaryReport { get; private set; } = null!;
    public decimal Value { get; private set; }

    internal void Set(decimal value) => Value = value;
}
