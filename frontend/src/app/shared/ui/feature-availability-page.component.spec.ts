import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { FeatureAvailabilityPageComponent } from './feature-availability-page.component';

describe('FeatureAvailabilityPageComponent', () => {
  let fixture: ComponentFixture<FeatureAvailabilityPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureAvailabilityPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                eyebrow: 'Operations',
                title: 'Billing',
                description: 'Billing workflows are still being finalized.',
                statusLabel: 'Coming soon',
                primaryAction: {
                  label: 'Open Dashboard',
                  path: '/dashboard'
                },
                secondaryAction: {
                  label: 'Open Tasks',
                  path: '/tasks'
                },
                notes: ['Stable sections remain available while this workspace is being prepared.']
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureAvailabilityPageComponent);
    fixture.detectChanges();
  });

  it('renders the configured title, status, and actions', () => {
    const text = fixture.nativeElement.textContent as string;
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>
    ).map(link => String(link.textContent ?? '').trim());

    expect(text).toContain('Operations');
    expect(text).toContain('Billing');
    expect(text).toContain('Coming soon');
    expect(links).toContain('Open Dashboard');
    expect(links).toContain('Open Tasks');
  });
});
