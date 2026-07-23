namespace EngineersSalary.Domain;

public sealed class ReferenceValue
{
    private ReferenceValue() { }
    public ReferenceValue(Guid catalogId, string value)
    {
        Id = Guid.NewGuid();
        CatalogId = catalogId;
        Value = value.Trim();
        NormalizedValue = Normalize(value);
    }

    public Guid Id { get; private set; }
    public Guid CatalogId { get; private set; }
    public ReferenceCatalog Catalog { get; private set; } = null!;
    public Guid? ParentValueId { get; private set; }
    public ReferenceValue? ParentValue { get; private set; }
    public string Value { get; private set; } = string.Empty;
    public string NormalizedValue { get; private set; } = string.Empty;
    private static string Normalize(string value) => value.Trim().ToUpperInvariant();
}
