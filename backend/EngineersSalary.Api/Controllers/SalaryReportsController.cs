using EngineersSalary.Application;
using EngineersSalary.Contracts;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Cryptography;
using System.Text;
using System.Net;

namespace EngineersSalary.Api.Controllers;

[ApiController]
[Route("api/salary-reports")]
[EnableRateLimiting("public-api")]
public sealed class SalaryReportsController(
    SalaryReportService salaryReportService,
    SalaryReportReadService salaryReportReadService,
    IGoogleSheetSalaryImportService googleSheetSalaryImportService,
    IHostEnvironment hostEnvironment,
    IConfiguration configuration,
    IValidator<CreateSalaryReportRequest> createSalaryReportValidator) : ControllerBase
{
    [HttpGet("read-rows")]
    [OutputCache(PolicyName = "salary-read")]
    [ProducesResponseType<SalaryReportReadRowPageDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SalaryReportReadRowPageDto>> ReadRows(
        [FromQuery] SalaryReportReadFilters filters,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await salaryReportReadService.ListPageAsync(filters, cancellationToken));
        }
        catch (ArgumentException exception)
        {
            ModelState.AddModelError(nameof(filters), exception.Message);
            return ValidationProblem(ModelState);
        }
    }

    [HttpGet("read-rows/summary")]
    [OutputCache(PolicyName = "salary-read")]
    [ProducesResponseType<SalaryReportReadSummaryDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SalaryReportReadSummaryDto>> ReadRowsSummary(
        [FromQuery] SalaryReportReadFilters filters,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await salaryReportReadService.GetSummaryAsync(filters, cancellationToken));
        }
        catch (ArgumentException exception)
        {
            ModelState.AddModelError(nameof(filters), exception.Message);
            return ValidationProblem(ModelState);
        }
    }

    [HttpPost("read-rows/aggregates")]
    [ProducesResponseType<SalaryReportAggregateResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SalaryReportAggregateResponseDto>> ReadRowsAggregates(
        SalaryReportAggregateRequestDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await salaryReportReadService.GetAggregatesAsync(request, cancellationToken));
        }
        catch (ArgumentException exception)
        {
            ModelState.AddModelError(nameof(request.Aggregates), exception.Message);
            return ValidationProblem(ModelState);
        }
    }

    [HttpGet("read-rows/filter-options")]
    [OutputCache(PolicyName = "salary-read")]
    [ProducesResponseType<IReadOnlyList<string>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<string>>> ReadRowsFilterOptions(
        [FromQuery] SalaryReportReadFilters filters,
        [FromQuery] string field,
        [FromQuery] string? optionSearch,
        [FromQuery] int? take,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await salaryReportReadService.ListFilterOptionsAsync(
                filters,
                field,
                optionSearch,
                take,
                cancellationToken));
        }
        catch (ArgumentException exception)
        {
            ModelState.AddModelError(nameof(field), exception.Message);
            return ValidationProblem(ModelState);
        }
    }

    [HttpGet("{id:guid}")]
    [OutputCache(PolicyName = "salary-read")]
    [ProducesResponseType<SalaryReportDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SalaryReportDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var report = await salaryReportService.GetPublishedByIdAsync(id, cancellationToken);
        return report is null ? NotFound() : Ok(report);
    }

    [HttpGet("options")]
    [OutputCache(PolicyName = "salary-options")]
    [ProducesResponseType<SalaryOptionsDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SalaryOptionsDto>> Options(CancellationToken cancellationToken)
    {
        var options = await salaryReportService.GetOptionsAsync(cancellationToken);
        return Ok(options);
    }

    [HttpPost]
    [EnableRateLimiting("salary-submission")]
    [ProducesResponseType<SalaryReportDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<SalaryReportDto>> Create(
        CreateSalaryReportRequest request,
        CancellationToken cancellationToken)
    {
        var validationResult = await createSalaryReportValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return BadRequest(new ValidationProblemDetails(validationResult.ToDictionary()));
        }

        var idempotencyKey = Request.Headers["Idempotency-Key"].ToString().Trim();
        if (idempotencyKey.Length is < 16 or > 100 ||
            idempotencyKey.Any(character => !char.IsLetterOrDigit(character) && character is not '-' and not '_' and not '.' and not ':'))
        {
            ModelState.AddModelError("Idempotency-Key", "A valid Idempotency-Key header between 16 and 100 characters is required.");
            return ValidationProblem(ModelState);
        }

        try
        {
            var result = await salaryReportService.CreateIdempotentAsync(
                request,
                idempotencyKey,
                cancellationToken);
            if (result.Created)
            {
                return CreatedAtAction(nameof(GetById), new { id = result.Report.Id }, result.Report);
            }

            Response.Headers.Append("Idempotent-Replay", "true");
            return Ok(result.Report);
        }
        catch (IdempotencyConflictException exception)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Idempotency key conflict",
                Detail = exception.Message
            });
        }
    }

    [HttpPost("synchronize-source")]
    [RequestTimeout("source-sync")]
    [EnableRateLimiting("source-sync")]
    [ProducesResponseType<GoogleSheetSalaryImportResult>(StatusCodes.Status200OK)]
    public async Task<ActionResult<GoogleSheetSalaryImportResult>> SynchronizeSource(CancellationToken cancellationToken)
    {
        if (!HasSynchronizationAccess())
        {
            return NotFound();
        }

        try
        {
            return Ok(await googleSheetSalaryImportService.SynchronizeAsync(cancellationToken));
        }
        catch (SourceSynchronizationInProgressException exception)
        {
            Response.Headers.RetryAfter = "10";
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Source synchronization already running",
                Detail = exception.Message,
            });
        }
    }

    private bool HasValidSynchronizationKey()
    {
        var expectedKey = configuration["GoogleSheetSalaryImport:SynchronizationKey"];
        if (string.IsNullOrWhiteSpace(expectedKey) ||
            !Request.Headers.TryGetValue("X-Source-Sync-Key", out var suppliedKey))
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedKey),
            Encoding.UTF8.GetBytes(suppliedKey.ToString()));
    }

    private bool HasSynchronizationAccess()
    {
        if (HasValidSynchronizationKey()) return true;
        var remoteAddress = HttpContext.Connection.RemoteIpAddress;
        return hostEnvironment.IsDevelopment() && remoteAddress is not null && IPAddress.IsLoopback(remoteAddress);
    }
}
