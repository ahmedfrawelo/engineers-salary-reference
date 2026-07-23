using EngineersSalary.Contracts;
using FluentValidation;

namespace EngineersSalary.Api.Validation;

public sealed class CreateSalaryReportRequestValidator : AbstractValidator<CreateSalaryReportRequest>
{
    public CreateSalaryReportRequestValidator()
    {
        RuleFor(request => request.Country).RequiredText().MaximumLength(100);
        RuleFor(request => request.City).RequiredText().MaximumLength(100);
        RuleFor(request => request.Discipline).RequiredText().MaximumLength(120);
        RuleFor(request => request.CompanyType).RequiredText().MaximumLength(120);
        RuleFor(request => request.MonthlyNetSalary).GreaterThan(0).LessThanOrEqualTo(10_000_000);
        RuleFor(request => request.Currency)
            .RequiredText()
            .Length(3)
            .Matches("^[A-Za-z]{3}$")
            .WithMessage("Currency must be a 3-letter ISO code.");
        RuleFor(request => request.YearsOfExperience).InclusiveBetween(0, 60);
        RuleFor(request => request.WorkMode).RequiredText().MaximumLength(80);
        RuleFor(request => request.Benefits).MaximumLength(600);
        RuleFor(request => request.HousingProvided).MaximumLength(80);
        RuleFor(request => request.TransportationProvided).MaximumLength(80);
        RuleFor(request => request.AnnualBonus).MaximumLength(80);
        RuleFor(request => request.SalaryFairness).MaximumLength(80);
        RuleFor(request => request.RecommendField).MaximumLength(80);
        RuleFor(request => request.NegotiationAdvice).MaximumLength(1000);
        RuleFor(request => request.ProfessionalCertificate).MaximumLength(120);
        RuleFor(request => request.HighestEducation).MaximumLength(120);
        RuleFor(request => request.DailyWorkHours).InclusiveBetween(0, 24).When(request => request.DailyWorkHours.HasValue);
        RuleFor(request => request.ExtraDayOff).MaximumLength(80);
    }
}

internal static class SalaryReportValidationRules
{
    public static IRuleBuilderOptions<T, string> RequiredText<T>(this IRuleBuilder<T, string> rule)
    {
        return rule.NotEmpty().Must(value => !string.IsNullOrWhiteSpace(value)).WithMessage("{PropertyName} is required.");
    }
}
