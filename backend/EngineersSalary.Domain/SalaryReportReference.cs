namespace EngineersSalary.Domain;

public sealed class SalaryReportReference
{
    private SalaryReportReference() { }
    public SalaryReportReference(Guid salaryReportId, Guid referenceValueId, string fieldCode)
    {
        Id = Guid.NewGuid();
        SalaryReportId = salaryReportId;
        ReferenceValueId = referenceValueId;
        FieldCode = fieldCode.Trim();
    }

    public Guid Id { get; private set; }
    public Guid SalaryReportId { get; private set; }
    public SalaryReport SalaryReport { get; private set; } = null!;
    public Guid ReferenceValueId { get; private set; }
    public ReferenceValue ReferenceValue { get; private set; } = null!;
    public string FieldCode { get; private set; } = string.Empty;

    public void ChangeReference(Guid referenceValueId)
    {
        ReferenceValueId = referenceValueId;
    }
}
