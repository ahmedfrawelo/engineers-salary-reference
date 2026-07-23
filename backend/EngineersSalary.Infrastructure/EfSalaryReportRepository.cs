using EngineersSalary.Application;
using EngineersSalary.Domain;
using Microsoft.EntityFrameworkCore;

namespace EngineersSalary.Infrastructure;

internal sealed class EfSalaryReportRepository(EngineersSalaryDbContext dbContext) : ISalaryReportRepository
{
    public Task<SalaryReport?> GetPublishedByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        return dbContext.SalaryReports
            .AsNoTracking()
            .FirstOrDefaultAsync(report => report.Id == id && report.Status == SalaryReportStatus.Published, cancellationToken);
    }

    public async Task<SalaryReportIdempotentCreateResult> CreateIdempotentAsync(
        SalaryReport report,
        string idempotencyKey,
        string requestHash,
        CancellationToken cancellationToken)
    {
        var existing = await FindIdempotencyRecordAsync(idempotencyKey, cancellationToken);
        if (existing is not null)
        {
            return ResolveIdempotency(existing, requestHash);
        }

        var executionStrategy = dbContext.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync(async () =>
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                await dbContext.SalaryReports.AddAsync(report, cancellationToken);
                await dbContext.SalarySubmissionIdempotencyRecords.AddAsync(
                    new SalarySubmissionIdempotencyRecord(
                        idempotencyKey,
                        requestHash,
                        report.Id,
                        DateTimeOffset.UtcNow),
                    cancellationToken);
                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return new SalaryReportIdempotentCreateResult(report, true);
            }
            catch (DbUpdateException)
            {
                await transaction.RollbackAsync(CancellationToken.None);
                dbContext.ChangeTracker.Clear();
                existing = await FindIdempotencyRecordAsync(idempotencyKey, cancellationToken);
                if (existing is null) throw;
                return ResolveIdempotency(existing, requestHash);
            }
        });
    }

    public async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> ListReferenceOptionsAsync(CancellationToken cancellationToken)
    {
        var rows = await dbContext.ReferenceValues
            .AsNoTracking()
            .Include(value => value.Catalog)
            .OrderBy(value => value.Catalog.Code)
            .ThenBy(value => value.Value)
            .Select(value => new { value.Catalog.Code, value.Value })
            .ToArrayAsync(cancellationToken);

        return rows.GroupBy(row => row.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(row => row.Value).ToArray(), StringComparer.OrdinalIgnoreCase);
    }

    public async Task<SalaryNumericOptions> ListNumericOptionsAsync(CancellationToken cancellationToken)
    {
        var monthlyNetSalaries = await dbContext.SalaryReports
            .AsNoTracking()
            .Where(report => report.Status == SalaryReportStatus.Published)
            .Select(report => report.MonthlyNetSalaryField.Value)
            .Distinct()
            .OrderBy(value => value)
            .Take(120)
            .ToArrayAsync(cancellationToken);
        var yearsOfExperience = await dbContext.SalaryReports
            .AsNoTracking()
            .Where(report => report.Status == SalaryReportStatus.Published)
            .Select(report => report.YearsOfExperienceField.Value)
            .Distinct()
            .OrderBy(value => value)
            .Take(120)
            .ToArrayAsync(cancellationToken);
        var dailyWorkHours = await dbContext.SalaryReports
            .AsNoTracking()
            .Where(report => report.Status == SalaryReportStatus.Published && report.DailyWorkHoursField.Value.HasValue)
            .Select(report => report.DailyWorkHoursField.Value!.Value)
            .Distinct()
            .OrderBy(value => value)
            .Take(120)
            .ToArrayAsync(cancellationToken);

        return new SalaryNumericOptions(monthlyNetSalaries, yearsOfExperience, dailyWorkHours);
    }

    private Task<SalarySubmissionIdempotencyRecord?> FindIdempotencyRecordAsync(
        string key,
        CancellationToken cancellationToken) => dbContext.SalarySubmissionIdempotencyRecords
            .AsNoTracking()
            .Include(record => record.SalaryReport)
            .SingleOrDefaultAsync(record => record.Key == key, cancellationToken);

    private static SalaryReportIdempotentCreateResult ResolveIdempotency(
        SalarySubmissionIdempotencyRecord record,
        string requestHash)
    {
        if (!string.Equals(record.RequestHash, requestHash, StringComparison.Ordinal))
        {
            throw new IdempotencyConflictException(
                "The supplied Idempotency-Key was already used with a different request body.");
        }

        return new SalaryReportIdempotentCreateResult(record.SalaryReport, false);
    }
}
