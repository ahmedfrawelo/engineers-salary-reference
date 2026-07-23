import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { FormValidationService } from './form-validation.service';
import { of } from 'rxjs';

describe('FormValidationService', () => {
  let service: FormValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FormValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('emailValidator', () => {
    it('should accept valid email', () => {
      const control = new FormControl('test@example.com');
      const validator = service.emailValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should reject invalid email', () => {
      const control = new FormControl('invalid-email');
      const validator = service.emailValidator();
      const result = validator(control);
      expect(result).toEqual({
        email: {
          value: 'invalid-email',
          message: 'البريد الإلكتروني غير صحيح'
        }
      });
    });

    it('should accept empty value', () => {
      const control = new FormControl('');
      const validator = service.emailValidator();
      const result = validator(control);
      expect(result).toBeNull();
    });
  });

  describe('phoneValidator', () => {
    it('should accept valid Saudi phone', () => {
      const control = new FormControl('0512345678');
      const validator = service.phoneValidator('SA');
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should accept Saudi phone with +966', () => {
      const control = new FormControl('+966512345678');
      const validator = service.phoneValidator('SA');
      const result = validator(control);
      expect(result).toBeNull();
    });

    it('should reject invalid phone', () => {
      const control = new FormControl('123');
      const validator = service.phoneValidator('SA');
      const result = validator(control);
      expect(result).toEqual({
        phone: {
          value: '123',
          message: 'رقم الهاتف غير صحيح (SA)'
        }
      });
    });
  });

  describe('requiredValidator', () => {
    it('should reject empty value', () => {
      const control = new FormControl('');
      const validator = service.requiredValidator('الاسم');
      const result = validator(control);
      expect(result).toEqual({
        required: {
          value: '',
          message: 'الاسم مطلوب'
        }
      });
    });

    it('should reject whitespace-only value', () => {
      const control = new FormControl('   ');
      const validator = service.requiredValidator('الاسم');
      const result = validator(control);
      expect(result).toBeTruthy();
    });

    it('should accept non-empty value', () => {
      const control = new FormControl('Test');
      const validator = service.requiredValidator('الاسم');
      const result = validator(control);
      expect(result).toBeNull();
    });
  });

  describe('minLengthValidator', () => {
    it('should reject short value', () => {
      const control = new FormControl('abc');
      const validator = service.minLengthValidator(5, 'كلمة المرور');
      const result = validator(control);
      expect(result?.minLength?.message).toBe('كلمة المرور يجب أن يحتوي على 5 حروف على الأقل');
    });

    it('should accept long enough value', () => {
      const control = new FormControl('abcdef');
      const validator = service.minLengthValidator(5);
      const result = validator(control);
      expect(result).toBeNull();
    });
  });

  describe('minValueValidator', () => {
    it('should reject low value', () => {
      const control = new FormControl(5);
      const validator = service.minValueValidator(10, 'العمر');
      const result = validator(control);
      expect(result?.minValue?.message).toBe('العمر يجب أن تكون 10 على الأقل');
    });

    it('should accept high enough value', () => {
      const control = new FormControl(15);
      const validator = service.minValueValidator(10);
      const result = validator(control);
      expect(result).toBeNull();
    });
  });

  describe('getErrorMessage', () => {
    it('should return error message from control', () => {
      const control = new FormControl('');
      control.setErrors({
        required: {
          message: 'هذا الحقل مطلوب'
        }
      });
      control.markAsTouched();

      const message = service.getErrorMessage(control);
      expect(message).toBe('هذا الحقل مطلوب');
    });

    it('should return empty string if not touched', () => {
      const control = new FormControl('');
      control.setErrors({ required: true });

      const message = service.getErrorMessage(control);
      expect(message).toBe('');
    });

    it('should return fallback message', () => {
      const control = new FormControl('');
      control.setErrors({ required: true });
      control.markAsTouched();

      const message = service.getErrorMessage(control);
      expect(message).toBe('هذا الحقل مطلوب');
    });
  });

  describe('hasError', () => {
    it('should return true when control has error and is touched', () => {
      const control = new FormControl('');
      control.setErrors({ required: true });
      control.markAsTouched();

      expect(service.hasError(control)).toBe(true);
    });

    it('should return false when control is not touched', () => {
      const control = new FormControl('');
      control.setErrors({ required: true });

      expect(service.hasError(control)).toBe(false);
    });

    it('should check specific error', () => {
      const control = new FormControl('');
      control.setErrors({ required: true });
      control.markAsTouched();

      expect(service.hasError(control, 'required')).toBe(true);
      expect(service.hasError(control, 'email')).toBe(false);
    });
  });
});
