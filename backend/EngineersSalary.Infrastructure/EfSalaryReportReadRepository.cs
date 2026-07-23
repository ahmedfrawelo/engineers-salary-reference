using EngineersSalary.Application;
using EngineersSalary.Contracts;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace EngineersSalary.Infrastructure;

internal sealed class EfSalaryReportReadRepository(EngineersSalaryDbContext dbContext) : ISalaryReportReadRepository
{
    private const string SqlServerReadViewSql = "SELECT Id, Discipline, Country, City, YearsOfExperience, CompanyType, WorkMode, Currency, MonthlyNetSalary, HousingProvided, TransportationProvided, AnnualBonus, SalaryFairness, RecommendField, NegotiationAdvice, ProfessionalCertificate, Benefits, HighestEducation, DailyWorkHours, ExtraDayOff FROM dbo.vwSalaryReportReadRows";
    private const string PostgreSqlReadViewSql = "SELECT \"Id\", \"Discipline\", \"Country\", \"City\", \"YearsOfExperience\", \"CompanyType\", \"WorkMode\", \"Currency\", \"MonthlyNetSalary\", \"HousingProvided\", \"TransportationProvided\", \"AnnualBonus\", \"SalaryFairness\", \"RecommendField\", \"NegotiationAdvice\", \"ProfessionalCertificate\", \"Benefits\", \"HighestEducation\", \"DailyWorkHours\", \"ExtraDayOff\" FROM \"vwSalaryReportReadRows\"";
    public async Task<SalaryReportReadPageResult> ListPageAsync(
        SalaryReportReadFilters filters,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var query = ApplyFilters(filters);
        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var effectivePageNumber = Math.Min(Math.Max(1, pageNumber), totalPages);
        var items = await ApplySort(query, filters.SortBy, filters.SortDirection)
            .Skip((effectivePageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToArrayAsync(cancellationToken);

        return new SalaryReportReadPageResult(items, totalCount, effectivePageNumber);
    }

    public async Task<SalaryReportReadSummaryDto> GetSummaryAsync(
        SalaryReportReadFilters filters,
        CancellationToken cancellationToken)
    {
        var query = ApplyFilters(filters);
        var statistics = await query
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Total = group.Count(),
                Average = group.Average(row => row.MonthlyNetSalary),
                Minimum = group.Min(row => row.MonthlyNetSalary),
                Maximum = group.Max(row => row.MonthlyNetSalary)
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (statistics is null)
        {
            return new SalaryReportReadSummaryDto(0, null, null, null, [], [], []);
        }

        var disciplineRows = await query
            .GroupBy(row => row.Discipline)
            .Select(group => new
            {
                Value = group.Key,
                Count = group.Count(),
                AverageSalary = group.Average(row => row.MonthlyNetSalary)
            })
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.Value)
            .Take(16)
            .ToArrayAsync(cancellationToken);
        var countryRows = await query
            .GroupBy(row => row.Country)
            .Select(group => new
            {
                Value = group.Key,
                Count = group.Count(),
                AverageSalary = group.Average(row => row.MonthlyNetSalary)
            })
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.Value)
            .Take(16)
            .ToArrayAsync(cancellationToken);
        var experienceRows = await query
            .GroupBy(row => row.YearsOfExperience)
            .Select(group => new
            {
                Value = group.Key,
                Count = group.Count(),
                AverageSalary = group.Average(row => row.MonthlyNetSalary)
            })
            .OrderBy(item => item.Value)
            .Take(32)
            .ToArrayAsync(cancellationToken);
        var byDiscipline = disciplineRows
            .Select(item => new SalaryReportReadBreakdownDto(item.Value, item.Count, Math.Round(item.AverageSalary, 2)))
            .ToArray();
        var byCountry = countryRows
            .Select(item => new SalaryReportReadBreakdownDto(item.Value, item.Count, Math.Round(item.AverageSalary, 2)))
            .ToArray();
        var byExperience = experienceRows
            .Select(item => new SalaryReportReadBreakdownDto(
                $"{item.Value} {(item.Value == 1 ? "year" : "years")}",
                item.Count,
                Math.Round(item.AverageSalary, 2)))
            .ToArray();

        return new SalaryReportReadSummaryDto(
            statistics.Total,
            Math.Round(statistics.Average, 2),
            statistics.Minimum,
            statistics.Maximum,
            byDiscipline,
            byCountry,
            byExperience);
    }

    public async Task<SalaryReportAggregateResponseDto> GetAggregatesAsync(
        SalaryReportAggregateRequestDto request,
        CancellationToken cancellationToken)
    {
        var scope = NormalizeAggregateScope(request.Scope);
        var filters = scope == "all" ? new SalaryReportReadFilters() : request.Filters ?? new SalaryReportReadFilters();
        IQueryable<SalaryReportReadRowDto> query = ApplyFilters(filters);
        int totalRows;

        if (scope == "page")
        {
            var pageSize = Math.Clamp(filters.PageSize ?? 100, 1, 200);
            var filteredCount = await query.CountAsync(cancellationToken);
            var totalPages = Math.Max(1, (int)Math.Ceiling(filteredCount / (double)pageSize));
            var pageNumber = Math.Min(Math.Max(1, filters.PageNumber ?? 1), totalPages);
            var offset = (pageNumber - 1) * pageSize;
            query = ApplySort(query, filters.SortBy, filters.SortDirection)
                .Skip(offset)
                .Take(pageSize);
            totalRows = Math.Min(pageSize, Math.Max(0, filteredCount - offset));
        }
        else
        {
            totalRows = await query.CountAsync(cancellationToken);
        }

        var computedValues = new Dictionary<(string Field, string Operation), object?>();
        var normalizedAggregates = request.Aggregates
            .Select(item => new
            {
                Request = item,
                Field = item.Field.Trim().ToLowerInvariant(),
                Operation = NormalizeAggregateOperation(item.Operation)
            })
            .ToArray();

        foreach (var fieldGroup in normalizedAggregates.GroupBy(item => item.Field))
        {
            var operations = fieldGroup.Select(item => item.Operation).Distinct().ToArray();
            if (fieldGroup.Key is "monthlynetsalary" or "yearsofexperience" or "dailyworkhours")
            {
                var values = SelectNumericValues(query, fieldGroup.Key);
                var fieldValues = await CalculateNumericAggregatesAsync(values, operations, totalRows, cancellationToken);
                foreach (var item in fieldValues)
                {
                    computedValues[(fieldGroup.Key, item.Key)] = item.Value;
                }
                continue;
            }

            var textValues = SelectTextValues(query, fieldGroup.Key);
            var textFieldValues = await CalculateTextAggregatesAsync(
                textValues,
                operations,
                totalRows,
                cancellationToken);
            foreach (var item in textFieldValues)
            {
                computedValues[(fieldGroup.Key, item.Key)] = item.Value;
            }
        }

        var results = normalizedAggregates
            .Select(item => new SalaryReportAggregateResultDto(
                item.Request.ResultKey,
                item.Operation,
                computedValues[(item.Field, item.Operation)]))
            .ToArray();

        return new SalaryReportAggregateResponseDto(scope, totalRows, results);
    }

    public Task<IReadOnlyList<string>> ListFilterOptionsAsync(
        SalaryReportReadFilters filters,
        string field,
        string? optionSearch,
        int take,
        CancellationToken cancellationToken)
    {
        var query = ApplyFilters(filters);
        return field switch
        {
            "discipline" => ListTextOptionsAsync(query.Select(row => row.Discipline), optionSearch, take, cancellationToken),
            "country" => ListTextOptionsAsync(query.Select(row => row.Country), optionSearch, take, cancellationToken),
            "city" => ListTextOptionsAsync(query.Select(row => row.City), optionSearch, take, cancellationToken),
            "companytype" => ListTextOptionsAsync(query.Select(row => row.CompanyType), optionSearch, take, cancellationToken),
            "workmode" => ListTextOptionsAsync(query.Select(row => row.WorkMode), optionSearch, take, cancellationToken),
            "currency" => ListTextOptionsAsync(query.Select(row => row.Currency), optionSearch, take, cancellationToken),
            "housingprovided" => ListTextOptionsAsync(query.Select(row => row.HousingProvided), optionSearch, take, cancellationToken),
            "transportationprovided" => ListTextOptionsAsync(query.Select(row => row.TransportationProvided), optionSearch, take, cancellationToken),
            "annualbonus" => ListTextOptionsAsync(query.Select(row => row.AnnualBonus), optionSearch, take, cancellationToken),
            "salaryfairness" => ListTextOptionsAsync(query.Select(row => row.SalaryFairness), optionSearch, take, cancellationToken),
            "recommendfield" => ListTextOptionsAsync(query.Select(row => row.RecommendField), optionSearch, take, cancellationToken),
            "negotiationadvice" => ListTextOptionsAsync(query.Select(row => row.NegotiationAdvice), optionSearch, take, cancellationToken),
            "professionalcertificate" => ListTextOptionsAsync(query.Select(row => row.ProfessionalCertificate), optionSearch, take, cancellationToken),
            "benefits" => ListTextOptionsAsync(query.Select(row => row.Benefits), optionSearch, take, cancellationToken),
            "highesteducation" => ListTextOptionsAsync(query.Select(row => row.HighestEducation), optionSearch, take, cancellationToken),
            "extradayoff" => ListTextOptionsAsync(query.Select(row => row.ExtraDayOff), optionSearch, take, cancellationToken),
            "yearsofexperience" => ListNumericOptionsAsync(query.Select(row => (decimal?)row.YearsOfExperience), optionSearch, take, cancellationToken),
            "monthlynetsalary" => ListNumericOptionsAsync(query.Select(row => (decimal?)row.MonthlyNetSalary), optionSearch, take, cancellationToken),
            "dailyworkhours" => ListNumericOptionsAsync(query.Select(row => row.DailyWorkHours), optionSearch, take, cancellationToken),
            _ => throw new ArgumentException($"Unsupported filter field '{field}'.", nameof(field))
        };
    }

    private IQueryable<SalaryReportReadRowDto> ApplyFilters(SalaryReportReadFilters filters)
    {
        var readViewSql = dbContext.Database.IsNpgsql() ? PostgreSqlReadViewSql : SqlServerReadViewSql;
        var query = dbContext.Database.SqlQueryRaw<SalaryReportReadRowDto>(readViewSql);

        if (!string.IsNullOrWhiteSpace(filters.Discipline)) query = query.Where(row => row.Discipline == filters.Discipline.Trim());
        if (!string.IsNullOrWhiteSpace(filters.Country)) query = query.Where(row => row.Country == filters.Country.Trim());
        if (!string.IsNullOrWhiteSpace(filters.City)) query = query.Where(row => row.City == filters.City.Trim());
        if (!string.IsNullOrWhiteSpace(filters.CompanyType)) query = query.Where(row => row.CompanyType == filters.CompanyType.Trim());
        if (!string.IsNullOrWhiteSpace(filters.WorkMode)) query = query.Where(row => row.WorkMode == filters.WorkMode.Trim());
        if (!string.IsNullOrWhiteSpace(filters.Currency)) query = query.Where(row => row.Currency == filters.Currency.Trim());
        if (!string.IsNullOrWhiteSpace(filters.HousingProvided)) query = query.Where(row => row.HousingProvided == filters.HousingProvided.Trim());
        if (!string.IsNullOrWhiteSpace(filters.TransportationProvided)) query = query.Where(row => row.TransportationProvided == filters.TransportationProvided.Trim());
        if (!string.IsNullOrWhiteSpace(filters.AnnualBonus)) query = query.Where(row => row.AnnualBonus == filters.AnnualBonus.Trim());
        if (!string.IsNullOrWhiteSpace(filters.SalaryFairness)) query = query.Where(row => row.SalaryFairness == filters.SalaryFairness.Trim());
        if (!string.IsNullOrWhiteSpace(filters.RecommendField)) query = query.Where(row => row.RecommendField == filters.RecommendField.Trim());
        if (!string.IsNullOrWhiteSpace(filters.ProfessionalCertificate)) query = query.Where(row => row.ProfessionalCertificate == filters.ProfessionalCertificate.Trim());
        if (!string.IsNullOrWhiteSpace(filters.Benefits)) query = query.Where(row => row.Benefits != null && row.Benefits.Contains(filters.Benefits.Trim()));
        if (!string.IsNullOrWhiteSpace(filters.HighestEducation)) query = query.Where(row => row.HighestEducation == filters.HighestEducation.Trim());
        if (!string.IsNullOrWhiteSpace(filters.ExtraDayOff)) query = query.Where(row => row.ExtraDayOff == filters.ExtraDayOff.Trim());
        if (!string.IsNullOrWhiteSpace(filters.NegotiationAdvice)) query = query.Where(row => row.NegotiationAdvice != null && row.NegotiationAdvice.Contains(filters.NegotiationAdvice.Trim()));
        if (filters.MinExperience.HasValue) query = query.Where(row => row.YearsOfExperience >= filters.MinExperience.Value);
        if (filters.MaxExperience.HasValue) query = query.Where(row => row.YearsOfExperience <= filters.MaxExperience.Value);
        if (filters.MinSalary.HasValue) query = query.Where(row => row.MonthlyNetSalary >= filters.MinSalary.Value);
        if (filters.MaxSalary.HasValue) query = query.Where(row => row.MonthlyNetSalary <= filters.MaxSalary.Value);
        if (filters.MinDailyWorkHours.HasValue) query = query.Where(row => row.DailyWorkHours >= filters.MinDailyWorkHours.Value);
        if (filters.MaxDailyWorkHours.HasValue) query = query.Where(row => row.DailyWorkHours <= filters.MaxDailyWorkHours.Value);
        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var term = filters.Search.Trim();
            query = query.Where(row => row.Discipline.Contains(term) || row.Country.Contains(term) || row.City.Contains(term) || row.CompanyType.Contains(term) || row.WorkMode.Contains(term));
        }

        return query;
    }

    private static IOrderedQueryable<SalaryReportReadRowDto> ApplySort(
        IQueryable<SalaryReportReadRowDto> query,
        string? sortBy,
        string? sortDirection)
    {
        var descending = !string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        var normalizedSort = sortBy?.Trim().ToLowerInvariant();
        if (normalizedSort is null or "id")
        {
            return descending ? query.OrderByDescending(row => row.Id) : query.OrderBy(row => row.Id);
        }

        var ordered = normalizedSort switch
        {
            "discipline" => descending ? query.OrderByDescending(row => row.Discipline) : query.OrderBy(row => row.Discipline),
            "country" => descending ? query.OrderByDescending(row => row.Country) : query.OrderBy(row => row.Country),
            "city" => descending ? query.OrderByDescending(row => row.City) : query.OrderBy(row => row.City),
            "companytype" => descending ? query.OrderByDescending(row => row.CompanyType) : query.OrderBy(row => row.CompanyType),
            "workmode" => descending ? query.OrderByDescending(row => row.WorkMode) : query.OrderBy(row => row.WorkMode),
            "currency" => descending ? query.OrderByDescending(row => row.Currency) : query.OrderBy(row => row.Currency),
            "yearsofexperience" => descending ? query.OrderByDescending(row => row.YearsOfExperience) : query.OrderBy(row => row.YearsOfExperience),
            "monthlynetsalary" => descending ? query.OrderByDescending(row => row.MonthlyNetSalary) : query.OrderBy(row => row.MonthlyNetSalary),
            "dailyworkhours" => descending ? query.OrderByDescending(row => row.DailyWorkHours) : query.OrderBy(row => row.DailyWorkHours),
            "annualbonus" => descending ? query.OrderByDescending(row => row.AnnualBonus) : query.OrderBy(row => row.AnnualBonus),
            _ => query.OrderByDescending(row => row.Id)
        };

        return descending
            ? ordered.ThenByDescending(row => row.Id)
            : ordered.ThenBy(row => row.Id);
    }

    private static IQueryable<string?> SelectTextValues(
        IQueryable<SalaryReportReadRowDto> query,
        string field) => field.Trim().ToLowerInvariant() switch
        {
            "discipline" => query.Select(row => row.Discipline),
            "country" => query.Select(row => row.Country),
            "city" => query.Select(row => row.City),
            "companytype" => query.Select(row => row.CompanyType),
            "workmode" => query.Select(row => row.WorkMode),
            "currency" => query.Select(row => row.Currency),
            "housingprovided" => query.Select(row => row.HousingProvided),
            "transportationprovided" => query.Select(row => row.TransportationProvided),
            "annualbonus" => query.Select(row => row.AnnualBonus),
            "salaryfairness" => query.Select(row => row.SalaryFairness),
            "recommendfield" => query.Select(row => row.RecommendField),
            "professionalcertificate" => query.Select(row => row.ProfessionalCertificate),
            "benefits" => query.Select(row => row.Benefits),
            "highesteducation" => query.Select(row => row.HighestEducation),
            "extradayoff" => query.Select(row => row.ExtraDayOff),
            "negotiationadvice" => query.Select(row => row.NegotiationAdvice),
            _ => throw new ArgumentException($"Unsupported aggregate field '{field}'.", nameof(field))
        };

    private static IQueryable<decimal?> SelectNumericValues(
        IQueryable<SalaryReportReadRowDto> query,
        string field) => field switch
        {
            "monthlynetsalary" => query.Select(row => (decimal?)row.MonthlyNetSalary),
            "yearsofexperience" => query.Select(row => (decimal?)row.YearsOfExperience),
            "dailyworkhours" => query.Select(row => row.DailyWorkHours),
            _ => throw new ArgumentException($"Unsupported numeric aggregate field '{field}'.", nameof(field))
        };

    private static async Task<IReadOnlyDictionary<string, object?>> CalculateNumericAggregatesAsync(
        IQueryable<decimal?> values,
        IReadOnlyCollection<string> operations,
        int totalRows,
        CancellationToken cancellationToken)
    {
        var results = new Dictionary<string, object?>();
        if (operations.Contains("count")) results["count"] = totalRows;
        if (totalRows == 0)
        {
            foreach (var operation in operations)
                results[operation] = operation == "percent" ? 0m : operation == "count" ? 0 : null;
            return results;
        }

        var populated = values.Where(value => value.HasValue).Select(value => value!.Value);
        var needsSnapshot = operations.Any(operation => operation is "sum" or "avg" or "min" or "max" or "percent");
        if (needsSnapshot)
        {
            var snapshot = await populated
                .GroupBy(_ => 1)
                .Select(group => new
                {
                    PopulatedCount = group.Count(),
                    Sum = group.Sum(),
                    Average = group.Average(),
                    Minimum = group.Min(),
                    Maximum = group.Max()
                })
                .SingleOrDefaultAsync(cancellationToken);

            if (snapshot is null)
            {
                foreach (var operation in operations.Where(operation => operation is "sum" or "avg" or "min" or "max" or "percent"))
                    results[operation] = operation == "percent" ? 0m : null;
            }
            else
            {
                if (operations.Contains("sum")) results["sum"] = Math.Round(snapshot.Sum, 2);
                if (operations.Contains("avg")) results["avg"] = Math.Round(snapshot.Average, 2);
                if (operations.Contains("min")) results["min"] = snapshot.Minimum;
                if (operations.Contains("max")) results["max"] = snapshot.Maximum;
                if (operations.Contains("percent")) results["percent"] = Math.Round(snapshot.PopulatedCount * 100m / totalRows, 2);
            }
        }

        if (operations.Contains("distinct"))
            results["distinct"] = await populated.Distinct().CountAsync(cancellationToken);
        if (operations.Contains("median"))
            results["median"] = await CalculateMedianAsync(populated, cancellationToken);

        return results;
    }

    private static async Task<IReadOnlyDictionary<string, object?>> CalculateTextAggregatesAsync(
        IQueryable<string?> values,
        IReadOnlyCollection<string> operations,
        int totalRows,
        CancellationToken cancellationToken)
    {
        var results = new Dictionary<string, object?>();
        if (operations.Contains("count")) results["count"] = totalRows;
        if (totalRows == 0)
        {
            foreach (var operation in operations.Where(operation => operation != "count"))
                results[operation] = operation == "percent" ? 0m : null;
            return results;
        }

        var populated = values.Where(value => value != null && value != string.Empty);
        if (operations.Any(operation => operation is "min" or "max" or "percent"))
        {
            var snapshot = await populated
                .GroupBy(_ => 1)
                .Select(group => new
                {
                    Count = group.Count(),
                    Minimum = group.Min(),
                    Maximum = group.Max(),
                })
                .SingleOrDefaultAsync(cancellationToken);
            if (operations.Contains("min")) results["min"] = snapshot?.Minimum;
            if (operations.Contains("max")) results["max"] = snapshot?.Maximum;
            if (operations.Contains("percent"))
                results["percent"] = snapshot is null ? 0m : Math.Round(snapshot.Count * 100m / totalRows, 2);
        }
        if (operations.Contains("distinct"))
            results["distinct"] = await populated.Distinct().CountAsync(cancellationToken);

        return results;
    }

    private static async Task<decimal?> CalculateMedianAsync(
        IQueryable<decimal> values,
        CancellationToken cancellationToken)
    {
        var count = await values.CountAsync(cancellationToken);
        if (count == 0) return null;

        var middleValues = await values
            .OrderBy(value => value)
            .Skip((count - 1) / 2)
            .Take(count % 2 == 0 ? 2 : 1)
            .ToArrayAsync(cancellationToken);

        return middleValues.Length == 2
            ? Math.Round((middleValues[0] + middleValues[1]) / 2m, 2)
            : middleValues[0];
    }

    private static string NormalizeAggregateScope(string scope) => scope.Trim().ToLowerInvariant();

    private static string NormalizeAggregateOperation(string operation) => operation.Trim().ToLowerInvariant() switch
    {
        "average" => "avg",
        "distinctcount" or "countdistinct" => "distinct",
        var normalized => normalized
    };

    private static async Task<IReadOnlyList<string>> ListTextOptionsAsync(
        IQueryable<string?> values,
        string? optionSearch,
        int take,
        CancellationToken cancellationToken)
    {
        var query = values.Where(value => value != null && value != string.Empty);
        if (!string.IsNullOrWhiteSpace(optionSearch))
        {
            var search = optionSearch.Trim();
            query = query.Where(value => value!.Contains(search));
        }

        return await query
            .Select(value => value!)
            .Distinct()
            .OrderBy(value => value)
            .Take(take)
            .ToArrayAsync(cancellationToken);
    }

    private static async Task<IReadOnlyList<string>> ListNumericOptionsAsync(
        IQueryable<decimal?> values,
        string? optionSearch,
        int take,
        CancellationToken cancellationToken)
    {
        var options = await values
            .Where(value => value.HasValue)
            .Distinct()
            .OrderBy(value => value)
            .Take(500)
            .ToArrayAsync(cancellationToken);
        var search = optionSearch?.Trim();
        return options
            .Select(value => value!.Value.ToString("0.##", CultureInfo.InvariantCulture))
            .Where(value => string.IsNullOrWhiteSpace(search) || value.Contains(search, StringComparison.OrdinalIgnoreCase))
            .Take(take)
            .ToArray();
    }

}
