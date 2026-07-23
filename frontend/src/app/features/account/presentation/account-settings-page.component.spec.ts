import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { AUTH_USER_FACADE } from '../../../core/auth/auth-user.facade';
import { AccountSettingsPageComponent } from './account-settings-page.component';

describe('AccountSettingsPageComponent', () => {
  it('focuses the requested settings section from the route query', () => {
    const scrollIntoView = vi.fn();

    TestBed.configureTestingModule({
      imports: [AccountSettingsPageComponent],
      providers: [
        {
          provide: AUTH_USER_FACADE,
          useValue: {
            user: signal({
              id: 'user-1',
              name: 'ENGINEERS_SALARY_REFERENCE User',
              email: 'user@engineers-salary-reference.local'
            }),
            isAuthenticated: () => true
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ section: 'security' })
            }
          }
        },
        {
          provide: DOCUMENT,
          useValue: document
        }
      ]
    });

    vi.useFakeTimers();
    const fixture = TestBed.createComponent(AccountSettingsPageComponent);
    const component = fixture.componentInstance;
    const getElementById = vi.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView
    } as unknown as HTMLElement);
    vi.runAllTimers();
    vi.useRealTimers();

    expect(component.focusedSection()).toBe('security');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    getElementById.mockRestore();
  });
});
