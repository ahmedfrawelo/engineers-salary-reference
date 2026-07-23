using System.Text;
using EngineersSalary.Contracts;

namespace EngineersSalary.Application;

public static class SalaryReportRequestNormalizer
{
    public static CreateSalaryReportRequest Normalize(CreateSalaryReportRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        return request with
        {
            Country = Required(request.Country),
            City = Required(request.City),
            Discipline = Required(request.Discipline),
            CompanyType = Required(request.CompanyType),
            WorkMode = Required(request.WorkMode),
            Currency = Required(request.Currency).ToUpperInvariant(),
            HousingProvided = Optional(request.HousingProvided),
            TransportationProvided = Optional(request.TransportationProvided),
            AnnualBonus = Optional(request.AnnualBonus),
            SalaryFairness = Optional(request.SalaryFairness),
            RecommendField = Optional(request.RecommendField),
            NegotiationAdvice = Optional(request.NegotiationAdvice),
            ProfessionalCertificate = Optional(request.ProfessionalCertificate),
            Benefits = Optional(request.Benefits),
            HighestEducation = Optional(request.HighestEducation),
            ExtraDayOff = Optional(request.ExtraDayOff)
        };
    }

    private static string Required(string value) => value.Normalize(NormalizationForm.FormKC).Trim();

    private static string? Optional(string? value)
    {
        var normalized = value?.Normalize(NormalizationForm.FormKC).Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }
}
