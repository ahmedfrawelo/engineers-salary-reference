import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { vi, describe, expect, it } from 'vitest';

import { AUTH_USER_FACADE } from '../../../core/auth/auth-user.facade';
import { AccountProfilePageComponent } from './account-profile-page.component';

describe('AccountProfilePageComponent', () => {
  it('hydrates the requested profile tab from the route query', () => {
    TestBed.configureTestingModule({
      imports: [AccountProfilePageComponent],
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
              queryParamMap: convertToParamMap({ tab: 'compliance' })
            }
          }
        },
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true)
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(AccountProfilePageComponent);
    const component = fixture.componentInstance;

    expect(component.activeTab()).toBe('compliance');
  });

  it('syncs the selected tab back into the route query params', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    const route = {
      snapshot: {
        queryParamMap: convertToParamMap({})
      }
    };

    TestBed.configureTestingModule({
      imports: [AccountProfilePageComponent],
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
        { provide: ActivatedRoute, useValue: route },
        {
          provide: Router,
          useValue: {
            navigate
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(AccountProfilePageComponent);
    const component = fixture.componentInstance;

    component.setActiveTab('network');

    expect(component.activeTab()).toBe('network');
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { tab: 'network' },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  });
});
