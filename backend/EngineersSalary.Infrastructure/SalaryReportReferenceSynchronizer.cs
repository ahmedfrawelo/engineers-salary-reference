using EngineersSalary.Domain;
using Microsoft.EntityFrameworkCore;

namespace EngineersSalary.Infrastructure;

internal static class SalaryReportReferenceSynchronizer
{
    private static readonly (string Code, string Label, Func<SalaryReport, string?> Value)[] Fields =
    [
        ("country", "Country", report => report.Country), ("city", "City", report => report.City),
        ("discipline", "Discipline", report => report.Discipline), ("company-type", "Company type", report => report.CompanyType),
        ("work-mode", "Work mode", report => report.WorkMode), ("currency", "Currency", report => report.Currency),
        ("housing", "Housing", report => report.HousingProvided), ("transportation", "Transportation", report => report.TransportationProvided),
        ("annual-bonus", "Annual bonus", report => report.AnnualBonus), ("salary-fairness", "Salary fairness", report => report.SalaryFairness),
        ("recommend-field", "Recommend field", report => report.RecommendField), ("certificate", "Professional certificate", report => report.ProfessionalCertificate),
        ("education", "Highest education", report => report.HighestEducation), ("extra-day-off", "Additional day off", report => report.ExtraDayOff)
    ];

    public static async Task SynchronizeAsync(EngineersSalaryDbContext dbContext, CancellationToken cancellationToken)
    {
        var reports = await dbContext.SalaryReports.AsNoTracking().ToArrayAsync(cancellationToken);
        var catalogs = await dbContext.ReferenceCatalogs.Include(catalog => catalog.Values).ToListAsync(cancellationToken);
        var catalogsByCode = catalogs.ToDictionary(catalog => catalog.Code, StringComparer.OrdinalIgnoreCase);
        foreach (var (code, label, valueSelector) in Fields)
        {
            if (!catalogsByCode.TryGetValue(code, out var catalog))
            {
                catalog = new ReferenceCatalog(code, label);
                dbContext.ReferenceCatalogs.Add(catalog);
                catalogs.Add(catalog);
                catalogsByCode[code] = catalog;
            }
            var existingValues = new HashSet<string>(
                catalog.Values.Select(item => Normalize(item.Value)),
                StringComparer.Ordinal);
            foreach (var value in reports.Select(valueSelector).Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!.Trim()).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                if (existingValues.Add(Normalize(value)))
                {
                    var reference = new ReferenceValue(catalog.Id, value);
                    catalog.Values.Add(reference);
                    dbContext.ReferenceValues.Add(reference);
                }
            }
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        var existingLinks = await dbContext.SalaryReportReferences.ToListAsync(cancellationToken);
        var values = await dbContext.ReferenceValues.Include(value => value.Catalog).ToListAsync(cancellationToken);
        var links = existingLinks.ToDictionary(
            link => (link.SalaryReportId, link.FieldCode),
            link => link);
        var valuesByFieldAndName = values.ToDictionary(
            value => (value.Catalog.Code, Normalize(value.Value)),
            value => value);
        foreach (var report in reports)
        foreach (var (code, _, valueSelector) in Fields)
        {
            var value = valueSelector(report)?.Trim();
            var linkKey = (report.Id, code);
            if (string.IsNullOrWhiteSpace(value))
            {
                if (links.Remove(linkKey, out var obsoleteLink))
                    dbContext.SalaryReportReferences.Remove(obsoleteLink);
                continue;
            }

            var reference = valuesByFieldAndName[(code, Normalize(value))];
            if (links.TryGetValue(linkKey, out var existingLink))
            {
                if (existingLink.ReferenceValueId != reference.Id)
                    existingLink.ChangeReference(reference.Id);
                continue;
            }

            var newLink = new SalaryReportReference(report.Id, reference.Id, code);
            dbContext.SalaryReportReferences.Add(newLink);
            links[linkKey] = newLink;
        }
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string Normalize(string value) => value.Trim().ToUpperInvariant();
}
