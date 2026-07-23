import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthFacadeService } from '../../../../auth/auth.service';
import { ToastService } from '../../../../shared/toast/toast.service';
import { AUTH_SCREEN_MESSAGES } from './constants/auth-screen.messages';
import { AuthScreenComponent } from './auth-screen.component';

type AuthMode = 'login' | 'signup';
const AUTH_SCREEN_RESOURCE_ROOT = resolve(
  process.cwd(),
  'src/app/features/auth/presentation/auth-screen'
);

describe('AuthScreenComponent', () => {
  let authStub: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    signup: ReturnType<typeof vi.fn>;
  };
  let routerStub: {
    navigateByUrl: ReturnType<typeof vi.fn>;
  };
  let toastStub: {
    warning: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    (
      window as typeof window & { __ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__?: { allowSelfRegistration?: boolean } }
    ).__ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__ = {
      allowSelfRegistration: true
    };

    authStub = {
      isAuthenticated: vi.fn(() => false),
      login: vi.fn(() => Promise.resolve()),
      signup: vi.fn(() => Promise.resolve(AUTH_SCREEN_MESSAGES.signupSuccess))
    };
    routerStub = {
      navigateByUrl: vi.fn(() => Promise.resolve(true))
    };
    toastStub = {
      warning: vi.fn(),
      error: vi.fn(),
      success: vi.fn()
    };
  });

  it('shows the first login validation error through toast notifications', async () => {
    const fixture = await createComponent('login');

    await fixture.componentInstance.submit();

    expect(toastStub.warning).toHaveBeenCalledWith(AUTH_SCREEN_MESSAGES.emailRequired, 5000);
    expect(authStub.login).not.toHaveBeenCalled();
  });

  it('blocks signup when passwords do not match and keeps signup side effects idle', async () => {
    const fixture = await createComponent('signup');
    const component = fixture.componentInstance;

    component.form.patchValue({
      fullName: 'ENGINEERS_SALARY_REFERENCE Test User',
      email: 'user@engineers-salary-reference.local',
      password: 'Abcd12345!',
      confirmPassword: 'Abcd12345?',
      acceptTerms: true
    });

    await component.submit();

    expect(toastStub.warning).toHaveBeenCalledWith(AUTH_SCREEN_MESSAGES.passwordMismatch, 5000);
    expect(authStub.signup).not.toHaveBeenCalled();
    expect(toastStub.success).not.toHaveBeenCalled();
  });

  it('logs in and sanitizes hostile return urls back to the dashboard', async () => {
    const fixture = await createComponent('login', '//evil.example');
    const component = fixture.componentInstance;

    component.form.patchValue({
      email: 'user@engineers-salary-reference.local',
      password: 'TopSecret123'
    });

    await component.submit();

    expect(authStub.login).toHaveBeenCalledWith('user@engineers-salary-reference.local', 'TopSecret123', true);
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('logs in and sanitizes nested login return urls back to the dashboard', async () => {
    const fixture = await createComponent('login', '/login?returnUrl=%2Fdashboard');
    const component = fixture.componentInstance;

    component.form.patchValue({
      email: 'user@engineers-salary-reference.local',
      password: 'TopSecret123'
    });

    await component.submit();

    expect(authStub.login).toHaveBeenCalledWith('user@engineers-salary-reference.local', 'TopSecret123', true);
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  async function createComponent(
    mode: AuthMode,
    returnUrl: string | null = null
  ): Promise<ComponentFixture<AuthScreenComponent>> {
    await resolveComponentResources((url: string) =>
      readFile(resolve(AUTH_SCREEN_RESOURCE_ROOT, url), 'utf8')
    );

    await TestBed.configureTestingModule({
      imports: [AuthScreenComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode },
              queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {})
            }
          }
        },
        { provide: AuthFacadeService, useValue: authStub },
        { provide: Router, useValue: routerStub },
        { provide: ToastService, useValue: toastStub },
        {
          provide: TranslateService,
          useValue: {
            instant: vi.fn((value: string) => value),
            get: vi.fn(() => ({ subscribe: vi.fn() }))
          }
        }
      ]
    }).compileComponents();

    return TestBed.createComponent(AuthScreenComponent);
  }
});
