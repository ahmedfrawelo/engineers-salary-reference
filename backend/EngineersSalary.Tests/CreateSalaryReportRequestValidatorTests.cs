using EngineersSalary.Api.Validation;
using EngineersSalary.Contracts;

namespace EngineersSalary.Tests;

public sealed class CreateSalaryReportRequestValidatorTests
{
    private readonly CreateSalaryReportRequestValidator validator = new();

    [Fact]
    public void Validate_rejects_required_text_that_only_contains_whitespace()
    {
        var request = ValidRequest() with { Discipline = "   " };

        var result = validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(CreateSalaryReportRequest.Discipline));
    }

    [Theory]
    [InlineData("EG")]
    [InlineData("123")]
    [InlineData("EGP1")]
    public void Validate_rejects_invalid_currency_codes(string currency)
    {
        var request = ValidRequest() with { Currency = currency };

        var result = validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(CreateSalaryReportRequest.Currency));
    }

    [Fact]
    public void Validate_accepts_the_google_form_shape()
    {
        var result = validator.Validate(ValidRequest());

        Assert.True(result.IsValid);
    }

    private static CreateSalaryReportRequest ValidRequest() => new(
        "Egypt",
        "Cairo",
        "Mechanical",
        5,
        "Consultant",
        "Hybrid",
        "EGP",
        30_000,
        "Yes",
        "No",
        "Yes",
        "Maybe",
        "Yes",
        "Negotiate on total package.",
        "PMP",
        "Medical insurance",
        "Bachelor's",
        8,
        "No");
}
