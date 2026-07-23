using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EngineersSalary.Contracts;

namespace EngineersSalary.Tests;

public sealed class SalaryReportsApiIntegrationTests : IAsyncLifetime
{
    private readonly SalaryApiFactory factory = new();

    public Task InitializeAsync() => factory.InitializeDatabaseAsync();

    public async Task DisposeAsync()
    {
        await factory.DeleteDatabaseAsync();
        await factory.DisposeAsync();
    }

    [Fact]
    public async Task CanonicalApi_SupportsSubmissionReplayReadsFiltersAggregatesAndStructuredErrors()
    {
        using var client = factory.CreateClient();

        using var readinessResponse = await client.GetAsync("/api/health/ready");
        Assert.Equal(HttpStatusCode.OK, readinessResponse.StatusCode);
        AssertSecurityHeaders(readinessResponse);

        using var livenessResponse = await client.GetAsync("/api/health/live");
        Assert.Equal(HttpStatusCode.OK, livenessResponse.StatusCode);

        var firstRequest = CreateRequest(
            discipline: "  Mechanical  ",
            currency: "egp",
            negotiationAdvice: "  Useful negotiation context.  ");
        using var firstMessage = new HttpRequestMessage(HttpMethod.Post, "/api/salary-reports")
        {
            Content = JsonContent.Create(firstRequest),
        };
        firstMessage.Headers.Add("Idempotency-Key", "integration-normalization-0001");

        using var createdResponse = await client.SendAsync(firstMessage);
        Assert.Equal(HttpStatusCode.Created, createdResponse.StatusCode);
        var createdJson = await createdResponse.Content.ReadAsStringAsync();
        using var createdDocument = JsonDocument.Parse(createdJson);
        Assert.True(createdDocument.RootElement.TryGetProperty("companyType", out _));
        Assert.False(createdDocument.RootElement.TryGetProperty("roleTitle", out _));
        Assert.False(createdDocument.RootElement.TryGetProperty("seniority", out _));
        Assert.False(createdDocument.RootElement.TryGetProperty("companyName", out _));
        Assert.False(createdDocument.RootElement.TryGetProperty("companySector", out _));
        Assert.False(createdDocument.RootElement.TryGetProperty("employmentType", out _));
        Assert.False(createdDocument.RootElement.TryGetProperty("isAnonymous", out _));
        Assert.False(createdDocument.RootElement.TryGetProperty("notes", out _));
        var created = JsonSerializer.Deserialize<SalaryReportDto>(
            createdJson,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(created);
        Assert.Equal("Mechanical", created.Discipline);
        Assert.Equal("EGP", created.Currency);
        Assert.Equal("Useful negotiation context.", created.NegotiationAdvice);

        var normalizedRequest = CreateRequest(
            discipline: "Mechanical",
            currency: "EGP",
            negotiationAdvice: "Useful negotiation context.");
        using var replayMessage = new HttpRequestMessage(HttpMethod.Post, "/api/salary-reports")
        {
            Content = JsonContent.Create(normalizedRequest),
        };
        replayMessage.Headers.Add("Idempotency-Key", "integration-normalization-0001");

        using var replayResponse = await client.SendAsync(replayMessage);
        Assert.Equal(HttpStatusCode.OK, replayResponse.StatusCode);
        Assert.Equal("true", replayResponse.Headers.GetValues("Idempotent-Replay").Single());
        var replayed = await replayResponse.Content.ReadFromJsonAsync<SalaryReportDto>();
        Assert.Equal(created.Id, replayed?.Id);

        using var conflictMessage = new HttpRequestMessage(HttpMethod.Post, "/api/salary-reports")
        {
            Content = JsonContent.Create(normalizedRequest with { MonthlyNetSalary = 26000 }),
        };
        conflictMessage.Headers.Add("Idempotency-Key", "integration-normalization-0001");
        using var conflictResponse = await client.SendAsync(conflictMessage);
        Assert.Equal(HttpStatusCode.Conflict, conflictResponse.StatusCode);

        using var missingKeyResponse = await client.PostAsJsonAsync(
            "/api/salary-reports",
            normalizedRequest);
        Assert.Equal(HttpStatusCode.BadRequest, missingKeyResponse.StatusCode);

        using var invalidSalaryMessage = new HttpRequestMessage(HttpMethod.Post, "/api/salary-reports")
        {
            Content = JsonContent.Create(normalizedRequest with { MonthlyNetSalary = 0 }),
        };
        invalidSalaryMessage.Headers.Add("Idempotency-Key", "integration-invalid-salary-0001");
        using var invalidSalaryResponse = await client.SendAsync(invalidSalaryMessage);
        Assert.Equal(HttpStatusCode.BadRequest, invalidSalaryResponse.StatusCode);

        using var detailResponse = await client.GetAsync($"/api/salary-reports/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);

        using var missingDetailResponse = await client.GetAsync($"/api/salary-reports/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, missingDetailResponse.StatusCode);

        using var rowsResponse = await client.GetAsync(
            "/api/salary-reports/read-rows?discipline=Mechanical&currency=EGP&pageNumber=1&pageSize=10&sortBy=monthlyNetSalary&sortDirection=desc");
        Assert.Equal(HttpStatusCode.OK, rowsResponse.StatusCode);
        var page = await rowsResponse.Content.ReadFromJsonAsync<SalaryReportReadRowPageDto>();
        Assert.NotNull(page);
        Assert.Equal(1, page.TotalCount);
        Assert.Single(page.Items);
        Assert.Equal(created.Id, page.Items[0].Id);

        using var summaryResponse = await client.GetAsync(
            "/api/salary-reports/read-rows/summary?discipline=Mechanical&currency=EGP");
        Assert.Equal(HttpStatusCode.OK, summaryResponse.StatusCode);
        var summary = await summaryResponse.Content.ReadFromJsonAsync<SalaryReportReadSummaryDto>();
        Assert.NotNull(summary);
        Assert.Equal(1, summary.TotalReports);
        Assert.Equal(25000, summary.AverageMonthlyNetSalary);
        Assert.Equal("Mechanical", Assert.Single(summary.ByDiscipline).Value);

        using var filterOptionsResponse = await client.GetAsync(
            "/api/salary-reports/read-rows/filter-options?field=discipline&optionSearch=Mech&take=10");
        Assert.Equal(HttpStatusCode.OK, filterOptionsResponse.StatusCode);
        var filterOptions = await filterOptionsResponse.Content.ReadFromJsonAsync<IReadOnlyList<string>>();
        Assert.Equal("Mechanical", Assert.Single(filterOptions!));

        using var optionsResponse = await client.GetAsync("/api/salary-reports/options");
        Assert.Equal(HttpStatusCode.OK, optionsResponse.StatusCode);
        var optionsJson = await optionsResponse.Content.ReadAsStringAsync();
        using var optionsDocument = JsonDocument.Parse(optionsJson);
        Assert.True(optionsDocument.RootElement.TryGetProperty("companyTypes", out _));
        Assert.False(optionsDocument.RootElement.TryGetProperty("companySectors", out _));
        Assert.False(optionsDocument.RootElement.TryGetProperty("roleTitles", out _));
        Assert.False(optionsDocument.RootElement.TryGetProperty("seniorities", out _));
        Assert.False(optionsDocument.RootElement.TryGetProperty("companyNames", out _));
        Assert.False(optionsDocument.RootElement.TryGetProperty("employmentTypes", out _));
        var options = JsonSerializer.Deserialize<SalaryOptionsDto>(
            optionsJson,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(options);
        Assert.Contains("Mechanical", options.Disciplines);
        Assert.Contains("EGP", options.Currencies);
        Assert.Contains(25000, options.MonthlyNetSalaries);

        using var aggregateResponse = await client.PostAsJsonAsync(
            "/api/salary-reports/read-rows/aggregates",
            new
            {
                filters = new { discipline = "Mechanical", currency = "EGP" },
                scope = "filtered",
                aggregates = new[]
                {
                    new { field = "monthlyNetSalary", operation = "median", resultKey = "medianSalary" },
                    new { field = "monthlyNetSalary", operation = "average", resultKey = "averageSalary" },
                },
            });
        Assert.Equal(HttpStatusCode.OK, aggregateResponse.StatusCode);
        var aggregates = await aggregateResponse.Content.ReadFromJsonAsync<SalaryReportAggregateResponseDto>();
        Assert.NotNull(aggregates);
        Assert.Equal(1, aggregates.TotalRows);
        Assert.Equal(2, aggregates.Aggregates.Count);

        using var textAggregateResponse = await client.PostAsJsonAsync(
            "/api/salary-reports/read-rows/aggregates",
            new
            {
                filters = new { discipline = "Mechanical" },
                scope = "filtered",
                aggregates = new[]
                {
                    new { field = "discipline", operation = "count", resultKey = "count" },
                    new { field = "discipline", operation = "min", resultKey = "minimum" },
                    new { field = "discipline", operation = "max", resultKey = "maximum" },
                    new { field = "discipline", operation = "distinct", resultKey = "distinct" },
                    new { field = "discipline", operation = "percent", resultKey = "percent" },
                },
            });
        Assert.Equal(HttpStatusCode.OK, textAggregateResponse.StatusCode);
        using var textAggregateDocument = JsonDocument.Parse(await textAggregateResponse.Content.ReadAsStringAsync());
        var textValues = textAggregateDocument.RootElement.GetProperty("aggregates")
            .EnumerateArray()
            .ToDictionary(
                item => item.GetProperty("field").GetString()!,
                item => item.GetProperty("value"));
        Assert.Equal(1, textValues["count"].GetInt32());
        Assert.Equal("Mechanical", textValues["minimum"].GetString());
        Assert.Equal("Mechanical", textValues["maximum"].GetString());
        Assert.Equal(1, textValues["distinct"].GetInt32());
        Assert.Equal(100m, textValues["percent"].GetDecimal());

        using var invalidAggregateResponse = await client.PostAsJsonAsync(
            "/api/salary-reports/read-rows/aggregates",
            new
            {
                filters = new { },
                scope = "filtered",
                aggregates = new[]
                {
                    new { field = "discipline", operation = "median", resultKey = "invalidMedian" },
                },
            });
        Assert.Equal(HttpStatusCode.BadRequest, invalidAggregateResponse.StatusCode);

        using var invalidAggregateScopeResponse = await client.PostAsJsonAsync(
            "/api/salary-reports/read-rows/aggregates",
            new
            {
                filters = new { },
                scope = "unknown",
                aggregates = new[]
                {
                    new { field = "monthlyNetSalary", operation = "average", resultKey = "salary" },
                },
            });
        Assert.Equal(HttpStatusCode.BadRequest, invalidAggregateScopeResponse.StatusCode);

        using var maximumPageAggregateResponse = await client.PostAsJsonAsync(
            "/api/salary-reports/read-rows/aggregates",
            new
            {
                filters = new { pageNumber = int.MaxValue, pageSize = 1 },
                scope = "page",
                aggregates = new[]
                {
                    new { field = "monthlyNetSalary", operation = "count", resultKey = "pageCount" },
                },
            });
        Assert.Equal(HttpStatusCode.OK, maximumPageAggregateResponse.StatusCode);
        var maximumPageAggregate = await maximumPageAggregateResponse.Content.ReadFromJsonAsync<SalaryReportAggregateResponseDto>();
        Assert.NotNull(maximumPageAggregate);
        Assert.Equal(1, maximumPageAggregate.TotalRows);

        using var invalidRangeResponse = await client.GetAsync(
            "/api/salary-reports/read-rows?minSalary=30000&maxSalary=20000");
        Assert.Equal(HttpStatusCode.BadRequest, invalidRangeResponse.StatusCode);

        using var invalidFilterFieldResponse = await client.GetAsync(
            "/api/salary-reports/read-rows/filter-options?field=unknownField");
        Assert.Equal(HttpStatusCode.BadRequest, invalidFilterFieldResponse.StatusCode);

        using var oversizedFilterResponse = await client.GetAsync(
            $"/api/salary-reports/read-rows?discipline={new string('x', 201)}");
        Assert.Equal(HttpStatusCode.BadRequest, oversizedFilterResponse.StatusCode);

        using var oversizedOptionSearchResponse = await client.GetAsync(
            $"/api/salary-reports/read-rows/filter-options?field=discipline&optionSearch={new string('x', 101)}");
        Assert.Equal(HttpStatusCode.BadRequest, oversizedOptionSearchResponse.StatusCode);

        using var removedLegacyListResponse = await client.GetAsync("/api/salary-reports");
        Assert.Equal(HttpStatusCode.MethodNotAllowed, removedLegacyListResponse.StatusCode);

        using var unauthorizedSourceSyncResponse = await client.PostAsync(
            "/api/salary-reports/synchronize-source",
            content: null);
        Assert.Equal(HttpStatusCode.NotFound, unauthorizedSourceSyncResponse.StatusCode);

        const string correlationId = "integration-invalid-sort-0001";
        using var invalidSortMessage = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/salary-reports/read-rows?sortBy=notARealColumn");
        invalidSortMessage.Headers.Add("X-Correlation-ID", correlationId);
        using var invalidSortResponse = await client.SendAsync(invalidSortMessage);
        Assert.Equal(HttpStatusCode.BadRequest, invalidSortResponse.StatusCode);
        using var problem = JsonDocument.Parse(await invalidSortResponse.Content.ReadAsStringAsync());
        Assert.True(problem.RootElement.TryGetProperty("traceId", out var traceId));
        Assert.False(string.IsNullOrWhiteSpace(traceId.GetString()));
        Assert.Equal(correlationId, problem.RootElement.GetProperty("correlationId").GetString());
    }

    [Fact]
    public async Task Aggregates_calculate_even_median_without_materializing_the_full_result_set()
    {
        using var client = factory.CreateClient();
        var request = CreateRequest("Median Verification", "EGP", null);

        await CreateReportAsync(client, request with { MonthlyNetSalary = 10_000 }, "median-even-record-0001");
        await CreateReportAsync(client, request with { MonthlyNetSalary = 30_000 }, "median-even-record-0002");

        using var response = await client.PostAsJsonAsync(
            "/api/salary-reports/read-rows/aggregates",
            new
            {
                filters = new { discipline = "Median Verification" },
                scope = "filtered",
                aggregates = new[]
                {
                    new { field = "monthlyNetSalary", operation = "median", resultKey = "medianSalary" },
                },
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;
        Assert.Equal(2, root.GetProperty("totalRows").GetInt32());
        Assert.Equal(20_000m, root.GetProperty("aggregates")[0].GetProperty("value").GetDecimal());
    }

    [Fact]
    public async Task Pagination_uses_id_as_a_stable_tie_breaker_for_equal_sort_values()
    {
        using var client = factory.CreateClient();
        var request = CreateRequest("Stable Pagination", "EGP", null) with { MonthlyNetSalary = 20_000 };
        await CreateReportAsync(client, request, "stable-pagination-record-0001");
        await CreateReportAsync(client, request, "stable-pagination-record-0002");
        await CreateReportAsync(client, request, "stable-pagination-record-0003");

        async Task<Guid[]> ReadPagesAsync()
        {
            var ids = new List<Guid>();
            for (var pageNumber = 1; pageNumber <= 3; pageNumber++)
            {
                var page = await client.GetFromJsonAsync<SalaryReportReadRowPageDto>(
                    $"/api/salary-reports/read-rows?discipline=Stable%20Pagination&pageNumber={pageNumber}&pageSize=1&sortBy=monthlyNetSalary&sortDirection=asc");
                Assert.NotNull(page);
                ids.Add(Assert.Single(page.Items).Id);
            }
            return ids.ToArray();
        }

        var firstPass = await ReadPagesAsync();
        var secondPass = await ReadPagesAsync();
        Assert.Equal(3, firstPass.Distinct().Count());
        Assert.Equal(firstPass, secondPass);
    }

    private static async Task CreateReportAsync(
        HttpClient client,
        CreateSalaryReportRequest request,
        string idempotencyKey)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, "/api/salary-reports")
        {
            Content = JsonContent.Create(request),
        };
        message.Headers.Add("Idempotency-Key", idempotencyKey);
        using var response = await client.SendAsync(message);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static void AssertSecurityHeaders(HttpResponseMessage response)
    {
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.Contains("default-src 'none'", response.Headers.GetValues("Content-Security-Policy").Single());
    }

    private static CreateSalaryReportRequest CreateRequest(
        string discipline,
        string currency,
        string? negotiationAdvice) => new(
            Country: "Egypt",
            City: "Cairo",
            Discipline: discipline,
            YearsOfExperience: 6,
            CompanyType: "Main Contractor",
            WorkMode: "On-site",
            Currency: currency,
            MonthlyNetSalary: 25000,
            HousingProvided: "No",
            TransportationProvided: "Yes",
            AnnualBonus: "Yes",
            SalaryFairness: "Fair",
            RecommendField: "Yes",
            NegotiationAdvice: negotiationAdvice,
            ProfessionalCertificate: "PMP",
            Benefits: "Medical insurance",
            HighestEducation: "Bachelor's degree",
            DailyWorkHours: 8,
            ExtraDayOff: "Friday");
}
