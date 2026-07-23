using EngineersSalary.Application;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;

namespace EngineersSalary.Api.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController(ISystemReadinessCheck readinessCheck, IConfiguration configuration, IHostEnvironment environment) : ControllerBase
{
    [HttpGet]
    [HttpGet("live")]
    public ActionResult<object> Live()
    {
        return Ok(new
        {
            status = "Healthy",
            service = "Engineers Salary API",
            checkedAt = DateTimeOffset.UtcNow
        });
    }

    [HttpGet("ready")]
    public ActionResult<object> Ready()
    {
        return Ok(new { status = "Ready", service = "Engineers Salary API" });
    }

    [HttpGet("database")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<object>> Database(CancellationToken cancellationToken)
    {
        if (!environment.IsDevelopment() && !HasDiagnosticAccess()) return NotFound();
        var readiness = await readinessCheck.CheckAsync(cancellationToken);
        var response = new
        {
            status = readiness.IsReady ? "Ready" : "NotReady",
            service = "Engineers Salary API",
            database = new
            {
                status = readiness.DatabaseStatus,
                latencyMilliseconds = readiness.DatabaseLatencyMilliseconds
            },
            readiness.FailureReason,
            checkedAt = DateTimeOffset.UtcNow
        };

        return readiness.IsReady
            ? Ok(response)
            : StatusCode(StatusCodes.Status503ServiceUnavailable, response);
    }

    private bool HasDiagnosticAccess()
    {
        var expected = configuration["Health:DiagnosticKey"];
        if (string.IsNullOrWhiteSpace(expected) || !Request.Headers.TryGetValue("X-Health-Diagnostic-Key", out var supplied)) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(supplied.ToString()));
    }
}
