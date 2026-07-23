using EngineersSalary.Contracts;

namespace EngineersSalary.Application;

public interface ISalaryReportReadRepository
{
    Task<SalaryReportReadPageResult> ListPageAsync(
        SalaryReportReadFilters filters,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken);

    Task<SalaryReportReadSummaryDto> GetSummaryAsync(
        SalaryReportReadFilters filters,
        CancellationToken cancellationToken);

    Task<SalaryReportAggregateResponseDto> GetAggregatesAsync(
        SalaryReportAggregateRequestDto request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<string>> ListFilterOptionsAsync(
        SalaryReportReadFilters filters,
        string field,
        string? optionSearch,
        int take,
        CancellationToken cancellationToken);
}

public sealed record SalaryReportReadPageResult(
    IReadOnlyList<SalaryReportReadRowDto> Items,
    int TotalCount,
    int PageNumber);
