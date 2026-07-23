namespace EngineersSalary.Application;

public interface ISalaryReportChangeNotifier
{
    ValueTask PublishAsync(SalaryReportChangeNotification notification, CancellationToken cancellationToken);

    IAsyncEnumerable<SalaryReportChangeNotification> SubscribeAsync(CancellationToken cancellationToken);
}

public sealed record SalaryReportChangeNotification(
    string Action,
    int ChangedCount,
    DateTimeOffset OccurredAt);
