import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn, AsyncValidatorFn } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Form Validation Service
 * خدمة موحدة لجميع validations مع رسائل عربية
 *
 * @example
 * ```typescript
 * constructor(private validation: FormValidationService) {}
 *
 * this.form = new FormGroup({
 *   email: new FormControl('', this.validation.emailValidator()),
 *   phone: new FormControl('', this.validation.phoneValidator('SA'))
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class FormValidationService {
  // ==================== Email Validators ====================

  /**
   * Email validator with Arabic error message
   */
  emailValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const isValid = emailRegex.test(control.value);

      return isValid
        ? null
        : {
            email: {
              value: control.value,
              message: 'البريد الإلكتروني غير صحيح'
            }
          };
    };
  }

  /**
   * Async email uniqueness validator
   * @param checkFn Function to check if email exists (returns Observable<boolean>)
   */
  emailUniqueValidator(checkFn: (email: string) => Observable<boolean>): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) return of(null);

      return timer(500).pipe(
        switchMap(() => checkFn(control.value)),
        map(exists =>
          exists
            ? {
                emailTaken: {
                  value: control.value,
                  message: 'هذا البريد الإلكتروني مستخدم بالفعل'
                }
              }
            : null
        )
      );
    };
  }

  // ==================== Phone Validators ====================

  /**
   * Phone validator (Saudi Arabia format)
   * Supports: 05XXXXXXXX, +9665XXXXXXXX, 9665XXXXXXXX
   */
  phoneValidator(country: 'SA' | 'AE' | 'EG' = 'SA'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const patterns = {
        SA: /^(05|5|\+9665|9665)\d{8}$/,
        AE: /^(05|5|\+9715|9715)\d{8}$/,
        EG: /^(01|1|\+201|201)\d{9}$/
      };

      const isValid = patterns[country].test(control.value.replace(/\s/g, ''));

      return isValid
        ? null
        : {
            phone: {
              value: control.value,
              message: `رقم الهاتف غير صحيح (${country})`
            }
          };
    };
  }

  // ==================== Required Validators ====================

  /**
   * Required validator with custom Arabic message
   */
  requiredValidator(fieldName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const isEmpty =
        !control.value || (typeof control.value === 'string' && control.value.trim().length === 0);

      return isEmpty
        ? {
            required: {
              value: control.value,
              message: `${fieldName} مطلوب`
            }
          }
        : null;
    };
  }

  // ==================== Min/Max Validators ====================

  /**
   * Min length validator with Arabic message
   */
  minLengthValidator(min: number, fieldName: string = 'الحقل'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const length = control.value.toString().length;
      return length < min
        ? {
            minLength: {
              requiredLength: min,
              actualLength: length,
              message: `${fieldName} يجب أن يحتوي على ${min} حروف على الأقل`
            }
          }
        : null;
    };
  }

  /**
   * Max length validator with Arabic message
   */
  maxLengthValidator(max: number, fieldName: string = 'الحقل'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const length = control.value.toString().length;
      return length > max
        ? {
            maxLength: {
              requiredLength: max,
              actualLength: length,
              message: `${fieldName} يجب ألا يتجاوز ${max} حرف`
            }
          }
        : null;
    };
  }

  /**
   * Min value validator (for numbers)
   */
  minValueValidator(min: number, fieldName: string = 'القيمة'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value && control.value !== 0) return null;

      const value = Number(control.value);
      return value < min
        ? {
            minValue: {
              min,
              actual: value,
              message: `${fieldName} يجب أن تكون ${min} على الأقل`
            }
          }
        : null;
    };
  }

  /**
   * Max value validator (for numbers)
   */
  maxValueValidator(max: number, fieldName: string = 'القيمة'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value && control.value !== 0) return null;

      const value = Number(control.value);
      return value > max
        ? {
            maxValue: {
              max,
              actual: value,
              message: `${fieldName} يجب ألا تتجاوز ${max}`
            }
          }
        : null;
    };
  }

  // ==================== Pattern Validators ====================

  /**
   * URL validator
   */
  urlValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      try {
        new URL(control.value);
        return null;
      } catch {
        return {
          url: {
            value: control.value,
            message: 'الرابط غير صحيح'
          }
        };
      }
    };
  }

  /**
   * Numbers only validator
   */
  numbersOnlyValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const isValid = /^\d+$/.test(control.value.toString());
      return isValid
        ? null
        : {
            numbersOnly: {
              value: control.value,
              message: 'يجب أن يحتوي على أرقام فقط'
            }
          };
    };
  }

  /**
   * Arabic letters only validator
   */
  arabicOnlyValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const isValid = /^[\u0600-\u06FF\s]+$/.test(control.value);
      return isValid
        ? null
        : {
            arabicOnly: {
              value: control.value,
              message: 'يجب أن يحتوي على حروف عربية فقط'
            }
          };
    };
  }

  /**
   * English letters only validator
   */
  englishOnlyValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const isValid = /^[a-zA-Z\s]+$/.test(control.value);
      return isValid
        ? null
        : {
            englishOnly: {
              value: control.value,
              message: 'يجب أن يحتوي على حروف إنجليزية فقط'
            }
          };
    };
  }

  // ==================== Cross-field Validators ====================

  /**
   * Match validator (for password confirmation)
   */
  matchValidator(matchTo: string, fieldName: string = 'الحقل'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const parent = control.parent;
      if (!parent) return null;

      const matchControl = parent.get(matchTo);
      if (!matchControl) return null;

      return control.value === matchControl.value
        ? null
        : {
            match: {
              value: control.value,
              message: `${fieldName} غير متطابق`
            }
          };
    };
  }

  /**
   * Date range validator (end date must be after start date)
   */
  dateRangeValidator(startDateField: string, endDateField: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const parent = control.parent;
      if (!parent) return null;

      const startDate = parent.get(startDateField)?.value;
      const endDate = parent.get(endDateField)?.value;

      if (!startDate || !endDate) return null;

      const start = new Date(startDate);
      const end = new Date(endDate);

      return end >= start
        ? null
        : {
            dateRange: {
              message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية'
            }
          };
    };
  }

  // ==================== Get Error Message ====================

  /**
   * Get error message from control
   * @param control FormControl or AbstractControl
   * @returns Arabic error message
   */
  getErrorMessage(control: AbstractControl | null): string {
    if (!control || !control.errors || !control.touched) return '';

    const errors = control.errors;
    const firstError = Object.keys(errors)[0];

    if (errors[firstError]?.message) {
      return errors[firstError].message;
    }

    // Fallback messages
    const fallbackMessages: Record<string, string> = {
      required: 'هذا الحقل مطلوب',
      email: 'البريد الإلكتروني غير صحيح',
      minlength: `يجب أن يحتوي على ${errors['minlength']?.requiredLength} حروف على الأقل`,
      maxlength: `يجب ألا يتجاوز ${errors['maxlength']?.requiredLength} حرف`,
      min: `القيمة يجب أن تكون ${errors['min']?.min} على الأقل`,
      max: `القيمة يجب ألا تتجاوز ${errors['max']?.max}`,
      pattern: 'التنسيق غير صحيح'
    };

    return fallbackMessages[firstError] || 'قيمة غير صالحة';
  }

  /**
   * Check if control has error and is touched
   */
  hasError(control: AbstractControl | null, errorName?: string): boolean {
    if (!control || !control.touched) return false;

    if (errorName) {
      return control.hasError(errorName);
    }

    return control.invalid;
  }

  /**
   * Mark all controls as touched (for form submission)
   */
  markFormGroupTouched(formGroup: AbstractControl): void {
    Object.keys((formGroup as LooseValue).controls).forEach(key => {
      const control = (formGroup as LooseValue).controls[key];
      control.markAsTouched();

      if (control.controls) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
