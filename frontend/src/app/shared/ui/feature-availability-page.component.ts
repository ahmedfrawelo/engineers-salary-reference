import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type AvailabilityAction = {
  label: string;
  path: string;
};

export type FeatureAvailabilityRouteData = {
  eyebrow?: string;
  title?: string;
  description?: string;
  statusLabel?: string;
  primaryAction?: AvailabilityAction | null;
  secondaryAction?: AvailabilityAction | null;
  notes?: string[];
};

@Component({
  selector: 'app-feature-availability-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="availability-page">
      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">{{ eyebrow }}</p>
          <div class="hero-headline">
            <h1>{{ title }}</h1>
            <span class="status-pill">{{ statusLabel }}</span>
          </div>
          <p class="description">{{ description }}</p>
        </div>

        <div class="hero-actions">
          @if (primaryAction; as action) {
            <a class="btn primary" [routerLink]="action.path">{{ action.label }}</a>
          }
          @if (secondaryAction; as action) {
            <a class="btn ghost" [routerLink]="action.path">{{ action.label }}</a>
          }
        </div>
      </header>

      <section class="support-grid">
        <article class="panel">
          <h2>What is happening</h2>
          <p>
            This area is intentionally held back until the workflow and API contract are ready.
            Stable sections remain available from the actions above.
          </p>
        </article>

        <article class="panel">
          <h2>Recommended next step</h2>
          <p>
            Continue from an active workspace for now, then revisit this section once it moves out
            of preview.
          </p>
          @if (notes.length > 0) {
            <ul class="notes">
              @for (note of notes; track note) {
                <li>{{ note }}</li>
              }
            </ul>
          }
        </article>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .availability-page {
        display: grid;
        gap: 18px;
        padding: 18px;
      }

      .hero,
      .panel {
        border: 1px solid rgb(var(--border) / 0.55);
        background: linear-gradient(180deg, rgb(var(--bg1)) 0%, rgb(var(--surface)) 100%);
        border-radius: 20px;
        box-shadow: 0 16px 40px rgb(0 0 0 / 0.18);
      }

      .hero {
        display: grid;
        gap: 18px;
        padding: 24px;
      }

      .hero-copy {
        display: grid;
        gap: 10px;
      }

      .eyebrow {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: rgb(var(--primary));
      }

      .hero-headline {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        font-size: clamp(26px, 3vw, 34px);
        line-height: 1.08;
        color: rgb(var(--fg));
      }

      .status-pill {
        padding: 6px 12px;
        border-radius: var(--app-pill-radius);
        border: 1px solid var(--app-color-pill-tone-border);
        background: var(--app-color-pill-tone-bg);
        color: var(--app-color-primary);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.3px;
      }

      .description {
        max-width: 70ch;
        color: rgb(var(--muted));
        font-size: 14px;
        line-height: 1.6;
      }

      .hero-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .btn {
        min-height: 40px;
        padding: 0 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        border: 1px solid rgb(var(--border) / 0.6);
        text-decoration: none;
        font-weight: 700;
        transition:
          transform 140ms ease,
          box-shadow 140ms ease,
          border-color 140ms ease;
      }

      .btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 22px rgb(0 0 0 / 0.18);
      }

      .btn.primary {
        border-color: transparent;
        background: rgb(var(--primary));
        color: #fff;
      }

      .btn.ghost {
        background: rgb(var(--bg1));
        color: rgb(var(--fg));
      }

      .support-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(2, minmax(260px, 1fr));
      }

      .panel {
        display: grid;
        gap: 12px;
        padding: 20px;
      }

      h2 {
        font-size: 16px;
        color: rgb(var(--fg));
      }

      .panel p,
      .notes {
        color: rgb(var(--muted));
        font-size: 14px;
        line-height: 1.55;
      }

      .notes {
        margin: 0;
        padding-inline-start: 18px;
      }

      .notes li + li {
        margin-top: 8px;
      }

      @media (max-width: 860px) {
        .support-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class FeatureAvailabilityPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = this.route.snapshot.data as FeatureAvailabilityRouteData;

  readonly eyebrow = String(this.data.eyebrow ?? 'Workspace status');
  readonly title = String(this.data.title ?? 'Feature not available');
  readonly description = String(
    this.data.description ?? 'This workflow is being prepared and is not ready for production use.'
  );
  readonly statusLabel = String(this.data.statusLabel ?? 'Coming soon');
  readonly primaryAction = this.normalizeAction(this.data.primaryAction);
  readonly secondaryAction = this.normalizeAction(this.data.secondaryAction);
  readonly notes = Array.isArray(this.data.notes)
    ? this.data.notes.filter(
        (note): note is string => typeof note === 'string' && note.trim().length > 0
      )
    : [];

  private normalizeAction(
    action: AvailabilityAction | null | undefined
  ): AvailabilityAction | null {
    if (!action?.label?.trim() || !action?.path?.trim()) {
      return null;
    }

    return {
      label: action.label.trim(),
      path: action.path.trim()
    };
  }
}
