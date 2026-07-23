namespace EngineersSalary.Domain;

public sealed class ReferenceCatalog
{
    private ReferenceCatalog() { }
    public ReferenceCatalog(string code, string label)
    {
        Id = Guid.NewGuid();
        Code = code.Trim();
        Label = label.Trim();
    }

    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Label { get; private set; } = string.Empty;
    public ICollection<ReferenceValue> Values { get; } = new List<ReferenceValue>();
}
