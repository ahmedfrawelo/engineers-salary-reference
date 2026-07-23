namespace EngineersSalary.Contracts;

public sealed record SalaryReportAggregateRequestDto(
    SalaryReportReadFilters Filters,
    string Scope,
    IReadOnlyList<SalaryReportAggregateItemRequestDto> Aggregates);

public sealed record SalaryReportAggregateItemRequestDto(
    string Field,
    string Operation,
    string ResultKey);

public sealed record SalaryReportAggregateResponseDto(
    string Scope,
    int TotalRows,
    IReadOnlyList<SalaryReportAggregateResultDto> Aggregates);

public sealed record SalaryReportAggregateResultDto(
    string Field,
    string Operation,
    object? Value);
