import { TestBed, getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { TenderProjectsFeatureFacade } from './tender-projects-feature.facade';
import { LegacyTenderProjectsAdapter } from '../infrastructure/adapters/tender-projects.adapter';
import { TenderProjectsRealtimeAdapter } from '../infrastructure/adapters/tender-projects-realtime.adapter';
import { TenderProjectsApi } from '../infrastructure/services/projects.api';

try {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  if (!message.includes('NG0400')) {
    throw error;
  }
}

describe('TenderProjectsFeatureFacade', () => {
  it('routes string owner updates to the rename-aware projects api path', async () => {
    const projectsApiStub = {
      updateOwner: vi.fn().mockReturnValue(of({ id: 12, name: 'Renamed' }))
    };
    const adapterStub = {
      updateLookup: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        TenderProjectsFeatureFacade,
        { provide: TenderProjectsApi, useValue: projectsApiStub },
        { provide: LegacyTenderProjectsAdapter, useValue: adapterStub },
        { provide: TenderProjectsRealtimeAdapter, useValue: {} }
      ]
    });

    const facade = TestBed.inject(TenderProjectsFeatureFacade);
    const value = await firstValueFrom(facade.api.updateOwner(12, 'Renamed'));

    expect(projectsApiStub.updateOwner).toHaveBeenCalledTimes(1);
    expect(projectsApiStub.updateOwner).toHaveBeenCalledWith(12, 'Renamed');
    expect(adapterStub.updateLookup).not.toHaveBeenCalled();
    expect(value).toEqual({ id: 12, name: 'Renamed' });
  });
});
