using EngineersSalary.Application;
using EngineersSalary.Contracts;

namespace EngineersSalary.Tests;

public sealed class SalaryReportReadServiceTests
{
    [Fact]
    public async Task ListPageAsync_caps_page_size_and_clamps_page_number()
    {
        var repository = new StubReadRepository(totalCount: 250);
        var service = new SalaryReportReadService(repository);

        var page = await service.ListPageAsync(
            new SalaryReportReadFilters(PageNumber: 9, PageSize: 5_000),
            CancellationToken.None);

        Assert.Equal(200, page.PageSize);
        Assert.Equal(2, page.PageNumber);
        Assert.Equal(1, repository.ListCalls);
        Assert.Equal(200, repository.LastPageSize);
    }

    [Fact]
    public async Task ListPageAsync_handles_maximum_page_number_without_overflow_or_retry()
    {
        var repository = new StubReadRepository(totalCount: 250);
        var service = new SalaryReportReadService(repository);

        var page = await service.ListPageAsync(
            new SalaryReportReadFilters(PageNumber: int.MaxValue, PageSize: 100),
            CancellationToken.None);

        Assert.Equal(3, page.PageNumber);
        Assert.Equal(1, repository.ListCalls);
    }

    [Fact]
    public async Task GetAggregatesAsync_rejects_unsupported_operation_before_repository_call()
    {
        var repository = new StubReadRepository();
        var service = new SalaryReportReadService(repository);
        var request = AggregateRequest(new SalaryReportAggregateItemRequestDto("monthlyNetSalary", "execute", "price"));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.GetAggregatesAsync(request, CancellationToken.None));

        Assert.Equal(0, repository.AggregateCalls);
    }

    [Fact]
    public async Task GetAggregatesAsync_accepts_supported_operations_and_preserves_result_key()
    {
        var repository = new StubReadRepository();
        var service = new SalaryReportReadService(repository);
        var request = AggregateRequest(new SalaryReportAggregateItemRequestDto("monthlyNetSalary", "median", "price"));

        var response = await service.GetAggregatesAsync(request, CancellationToken.None);

        Assert.Equal(1, repository.AggregateCalls);
        Assert.Equal("price", response.Aggregates[0].Field);
        Assert.Equal("median", response.Aggregates[0].Operation);
    }

    [Fact]
    public async Task ListPageAsync_rejects_unknown_sort_field_before_repository_call()
    {
        var repository = new StubReadRepository();
        var service = new SalaryReportReadService(repository);

        await Assert.ThrowsAsync<ArgumentException>(() => service.ListPageAsync(
            new SalaryReportReadFilters(SortBy: "DROP TABLE"),
            CancellationToken.None));

        Assert.Equal(0, repository.ListCalls);
    }

    [Fact]
    public async Task GetAggregatesAsync_rejects_numeric_operation_for_text_field()
    {
        var repository = new StubReadRepository();
        var service = new SalaryReportReadService(repository);

        await Assert.ThrowsAsync<ArgumentException>(() => service.GetAggregatesAsync(
            AggregateRequest(new SalaryReportAggregateItemRequestDto("discipline", "sum", "invalid")),
            CancellationToken.None));

        Assert.Equal(0, repository.AggregateCalls);
    }

    [Fact]
    public async Task GetAggregatesAsync_rejects_duplicate_result_keys()
    {
        var repository = new StubReadRepository();
        var service = new SalaryReportReadService(repository);

        await Assert.ThrowsAsync<ArgumentException>(() => service.GetAggregatesAsync(
            AggregateRequest(
                new SalaryReportAggregateItemRequestDto("monthlyNetSalary", "avg", "salary"),
                new SalaryReportAggregateItemRequestDto("monthlyNetSalary", "max", "SALARY")),
            CancellationToken.None));

        Assert.Equal(0, repository.AggregateCalls);
    }

    [Theory]
    [InlineData("")]
    [InlineData("unknown")]
    public async Task GetAggregatesAsync_rejects_invalid_scope_before_repository_call(string scope)
    {
        var repository = new StubReadRepository();
        var service = new SalaryReportReadService(repository);
        var request = AggregateRequest(
            new SalaryReportAggregateItemRequestDto("monthlyNetSalary", "avg", "salary")) with
        {
            Scope = scope,
        };

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.GetAggregatesAsync(request, CancellationToken.None));

        Assert.Equal(0, repository.AggregateCalls);
    }

    [Fact]
    public async Task GetSummaryAsync_rejects_reversed_ranges()
    {
        var repository = new StubReadRepository();
        var service = new SalaryReportReadService(repository);

        await Assert.ThrowsAsync<ArgumentException>(() => service.GetSummaryAsync(
            new SalaryReportReadFilters(MinSalary: 20_000, MaxSalary: 10_000),
            CancellationToken.None));
    }

    [Fact]
    public async Task ListPageAsync_rejects_oversized_text_filter_before_repository_call()
    {
        var repository = new StubReadRepository();
        var service = new SalaryReportReadService(repository);

        await Assert.ThrowsAsync<ArgumentException>(() => service.ListPageAsync(
            new SalaryReportReadFilters(Discipline: new string('x', 201)),
            CancellationToken.None));

        Assert.Equal(0, repository.ListCalls);
    }

    [Fact]
    public async Task ListFilterOptionsAsync_rejects_oversized_option_search_before_repository_call()
    {
        var repository = new StubReadRepository();
        var service = new SalaryReportReadService(repository);

        await Assert.ThrowsAsync<ArgumentException>(() => service.ListFilterOptionsAsync(
            new SalaryReportReadFilters(),
            "discipline",
            new string('x', 101),
            10,
            CancellationToken.None));

        Assert.Equal(0, repository.FilterOptionCalls);
    }

    private static SalaryReportAggregateRequestDto AggregateRequest(params SalaryReportAggregateItemRequestDto[] aggregates)
        => new(new SalaryReportReadFilters(), "filtered", aggregates);

    private sealed class StubReadRepository(int totalCount = 1) : ISalaryReportReadRepository
    {
        public int ListCalls { get; private set; }
        public int AggregateCalls { get; private set; }
        public int FilterOptionCalls { get; private set; }
        public int LastPageSize { get; private set; }

        public Task<SalaryReportReadPageResult> ListPageAsync(
            SalaryReportReadFilters filters,
            int pageNumber,
            int pageSize,
            CancellationToken cancellationToken)
        {
            ListCalls += 1;
            LastPageSize = pageSize;
            var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
            var effectivePage = Math.Min(Math.Max(1, pageNumber), totalPages);
            return Task.FromResult(new SalaryReportReadPageResult([], totalCount, effectivePage));
        }

        public Task<SalaryReportReadSummaryDto> GetSummaryAsync(
            SalaryReportReadFilters filters,
            CancellationToken cancellationToken)
            => Task.FromResult(new SalaryReportReadSummaryDto(0, null, null, null, [], [], []));

        public Task<SalaryReportAggregateResponseDto> GetAggregatesAsync(
            SalaryReportAggregateRequestDto request,
            CancellationToken cancellationToken)
        {
            AggregateCalls += 1;
            var results = request.Aggregates
                .Select(item => new SalaryReportAggregateResultDto(item.ResultKey, item.Operation, 1m))
                .ToArray();
            return Task.FromResult(new SalaryReportAggregateResponseDto(request.Scope, totalCount, results));
        }

        public Task<IReadOnlyList<string>> ListFilterOptionsAsync(
            SalaryReportReadFilters filters,
            string field,
            string? optionSearch,
            int take,
            CancellationToken cancellationToken)
        {
            FilterOptionCalls += 1;
            return Task.FromResult((IReadOnlyList<string>)["Mechanical"]);
        }
    }
}
