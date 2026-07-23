using EngineersSalary.Contracts;

namespace EngineersSalary.Application;

public sealed class SalaryReportReadService(ISalaryReportReadRepository repository)
{
    private const int DefaultPageSize = 100;
    private const int MaximumPageSize = 200;
    private const int MaximumAggregateCount = 32;
    private const int MaximumFilterTextLength = 200;
    private const int MaximumOptionSearchLength = 100;
    private static readonly HashSet<string> SupportedAggregateOperations =
        ["sum", "avg", "average", "count", "min", "max", "distinct", "distinctcount", "countdistinct", "median", "percent"];
    private static readonly HashSet<string> SupportedReadFields =
    [
        "discipline", "country", "city", "yearsofexperience", "companytype", "workmode",
        "currency", "monthlynetsalary", "housingprovided", "transportationprovided",
        "annualbonus", "salaryfairness", "recommendfield", "negotiationadvice",
        "professionalcertificate", "benefits", "highesteducation", "dailyworkhours",
        "extradayoff"
    ];
    private static readonly HashSet<string> SupportedSortFields =
    [
        "id", "discipline", "country", "city", "companytype", "workmode", "currency",
        "yearsofexperience", "monthlynetsalary", "dailyworkhours", "annualbonus"
    ];
    private static readonly HashSet<string> NumericAggregateFields =
        ["monthlynetsalary", "yearsofexperience", "dailyworkhours"];
    private static readonly HashSet<string> SupportedAggregateScopes =
        ["page", "filtered", "all"];

    public async Task<SalaryReportReadRowPageDto> ListPageAsync(
        SalaryReportReadFilters filters,
        CancellationToken cancellationToken)
    {
        ValidateFilters(filters);
        var pageSize = NormalizePageSize(filters.PageSize);
        var requestedPage = Math.Max(1, filters.PageNumber ?? 1);
        var page = await repository.ListPageAsync(filters, requestedPage, pageSize, cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(page.TotalCount / (double)pageSize));
        return new SalaryReportReadRowPageDto(page.Items, page.TotalCount, page.PageNumber, pageSize, totalPages);
    }

    public Task<SalaryReportReadSummaryDto> GetSummaryAsync(
        SalaryReportReadFilters filters,
        CancellationToken cancellationToken)
    {
        ValidateFilters(filters);
        return repository.GetSummaryAsync(filters, cancellationToken);
    }

    public Task<SalaryReportAggregateResponseDto> GetAggregatesAsync(
        SalaryReportAggregateRequestDto request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidateFilters(request.Filters ?? new SalaryReportReadFilters());
        if (string.IsNullOrWhiteSpace(request.Scope) ||
            !SupportedAggregateScopes.Contains(request.Scope.Trim().ToLowerInvariant()))
        {
            throw new ArgumentException("Aggregate scope must be 'page', 'filtered', or 'all'.", nameof(request));
        }
        if (request.Aggregates is null || request.Aggregates.Count == 0)
        {
            throw new ArgumentException("At least one aggregate is required.", nameof(request));
        }

        if (request.Aggregates.Count > MaximumAggregateCount)
        {
            throw new ArgumentException($"A maximum of {MaximumAggregateCount} aggregates is allowed.", nameof(request));
        }

        if (request.Aggregates.Any(item => !IsValidAggregate(item)))
        {
            throw new ArgumentException("One or more aggregate definitions are invalid.", nameof(request));
        }

        if (request.Aggregates.Select(item => item.ResultKey.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != request.Aggregates.Count)
        {
            throw new ArgumentException("Aggregate result keys must be unique.", nameof(request));
        }

        return repository.GetAggregatesAsync(request, cancellationToken);
    }

    public Task<IReadOnlyList<string>> ListFilterOptionsAsync(
        SalaryReportReadFilters filters,
        string field,
        string? optionSearch,
        int? take,
        CancellationToken cancellationToken)
    {
        ValidateFilters(filters);
        if (string.IsNullOrWhiteSpace(field))
        {
            throw new ArgumentException("Filter field is required.", nameof(field));
        }

        var normalizedField = field.Trim().ToLowerInvariant();
        if (!SupportedReadFields.Contains(normalizedField))
        {
            throw new ArgumentException($"Unsupported filter field '{field}'.", nameof(field));
        }
        if (optionSearch?.Length > MaximumOptionSearchLength)
        {
            throw new ArgumentException(
                $"Option search cannot exceed {MaximumOptionSearchLength} characters.",
                nameof(optionSearch));
        }

        return repository.ListFilterOptionsAsync(
            filters,
            normalizedField,
            optionSearch?.Trim(),
            Math.Clamp(take ?? 200, 1, 500),
            cancellationToken);
    }

    private static int NormalizePageSize(int? pageSize) => pageSize switch
    {
        null => DefaultPageSize,
        < 1 => DefaultPageSize,
        > MaximumPageSize => MaximumPageSize,
        _ => pageSize.Value
    };

    private static bool IsValidAggregate(SalaryReportAggregateItemRequestDto item)
    {
        if (string.IsNullOrWhiteSpace(item.Field) || string.IsNullOrWhiteSpace(item.ResultKey) || item.ResultKey.Length > 80)
        {
            return false;
        }

        var field = item.Field.Trim().ToLowerInvariant();
        var operation = NormalizeAggregateOperation(item.Operation);
        if (!SupportedReadFields.Contains(field) || string.IsNullOrWhiteSpace(operation) || !SupportedAggregateOperations.Contains(operation))
        {
            return false;
        }

        return NumericAggregateFields.Contains(field)
            || operation is "count" or "min" or "max" or "distinct" or "percent";
    }

    private static string NormalizeAggregateOperation(string? operation) => operation?.Trim().ToLowerInvariant() switch
    {
        "average" => "avg",
        "distinctcount" or "countdistinct" => "distinct",
        var normalized => normalized ?? string.Empty
    };

    private static void ValidateFilters(SalaryReportReadFilters filters)
    {
        ArgumentNullException.ThrowIfNull(filters);
        if (filters.MinExperience is < 0 || filters.MaxExperience is < 0 || filters.MinExperience > filters.MaxExperience)
            throw new ArgumentException("Experience range is invalid.", nameof(filters));
        if (filters.MinSalary is < 0 || filters.MaxSalary is < 0 || filters.MinSalary > filters.MaxSalary)
            throw new ArgumentException("Salary range is invalid.", nameof(filters));
        if (filters.MinDailyWorkHours is < 0 or > 24 || filters.MaxDailyWorkHours is < 0 or > 24 || filters.MinDailyWorkHours > filters.MaxDailyWorkHours)
            throw new ArgumentException("Daily work hours range is invalid.", nameof(filters));
        if (!string.IsNullOrWhiteSpace(filters.SortDirection) &&
            !string.Equals(filters.SortDirection, "asc", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(filters.SortDirection, "desc", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Sort direction must be 'asc' or 'desc'.", nameof(filters));
        if (!string.IsNullOrWhiteSpace(filters.SortBy) && !SupportedSortFields.Contains(filters.SortBy.Trim().ToLowerInvariant()))
            throw new ArgumentException($"Unsupported sort field '{filters.SortBy}'.", nameof(filters));
        foreach (var (name, value) in TextFilters(filters))
        {
            if (value?.Length > MaximumFilterTextLength)
                throw new ArgumentException(
                    $"Filter '{name}' cannot exceed {MaximumFilterTextLength} characters.",
                    nameof(filters));
        }
    }

    private static IEnumerable<(string Name, string? Value)> TextFilters(SalaryReportReadFilters filters)
    {
        yield return (nameof(filters.Discipline), filters.Discipline);
        yield return (nameof(filters.Country), filters.Country);
        yield return (nameof(filters.City), filters.City);
        yield return (nameof(filters.CompanyType), filters.CompanyType);
        yield return (nameof(filters.WorkMode), filters.WorkMode);
        yield return (nameof(filters.Currency), filters.Currency);
        yield return (nameof(filters.HousingProvided), filters.HousingProvided);
        yield return (nameof(filters.TransportationProvided), filters.TransportationProvided);
        yield return (nameof(filters.AnnualBonus), filters.AnnualBonus);
        yield return (nameof(filters.SalaryFairness), filters.SalaryFairness);
        yield return (nameof(filters.RecommendField), filters.RecommendField);
        yield return (nameof(filters.ProfessionalCertificate), filters.ProfessionalCertificate);
        yield return (nameof(filters.Benefits), filters.Benefits);
        yield return (nameof(filters.HighestEducation), filters.HighestEducation);
        yield return (nameof(filters.ExtraDayOff), filters.ExtraDayOff);
        yield return (nameof(filters.NegotiationAdvice), filters.NegotiationAdvice);
        yield return (nameof(filters.Search), filters.Search);
    }
}
