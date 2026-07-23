using EngineersSalary.Application;
using EngineersSalary.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EngineersSalary.Tests;

public sealed class SqlServerSynchronizationLockTests : IAsyncLifetime
{
    private readonly SalaryApiFactory factory = new();

    public Task InitializeAsync() => factory.InitializeDatabaseAsync();

    public async Task DisposeAsync()
    {
        await factory.DeleteDatabaseAsync();
        await factory.DisposeAsync();
    }

    [Fact]
    public async Task AcquireAsync_rejects_a_competing_transaction_for_the_same_source()
    {
        await using var firstScope = factory.Services.CreateAsyncScope();
        await using var secondScope = factory.Services.CreateAsyncScope();
        var firstDb = firstScope.ServiceProvider.GetRequiredService<EngineersSalaryDbContext>();
        var secondDb = secondScope.ServiceProvider.GetRequiredService<EngineersSalaryDbContext>();
        await using var firstTransaction = await firstDb.Database.BeginTransactionAsync();
        await using var secondTransaction = await secondDb.Database.BeginTransactionAsync();

        await SqlServerSynchronizationLock.AcquireAsync(firstDb, "test-source", CancellationToken.None);

        await Assert.ThrowsAsync<SourceSynchronizationInProgressException>(() =>
            SqlServerSynchronizationLock.AcquireAsync(secondDb, "test-source", CancellationToken.None));
    }
}
