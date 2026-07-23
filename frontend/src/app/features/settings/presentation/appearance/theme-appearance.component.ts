import { Component, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  THEME_SCOPE_META,
  THEME_TOKENS,
  ThemeScope,
  ThemeTokenId,
  ThemeOverrides,
  applyThemeOverrides,
  cloneThemeOverrides,
  effectiveHex,
  loadThemeOverrides,
  normalizeHex,
  removeTokenOverride,
  saveThemeOverrides
} from './theme-overrides.local';

@Component({
  standalone: true,
  selector: 'appearance-settings-page',
  imports: [RouterLink],
  template: `
    <section class="appearance-page">
      <header class="hero">
        <div class="hero-text">
          <p class="eyebrow">Look &amp; Feel</p>
          <h1>Theme &amp; color system</h1>
          <p class="hero-sub">
            Fine-tune every token — brand accents, backgrounds, borders, and text contrast — per
            theme. Changes preview instantly; save to persist across sessions.
          </p>
          <div class="hero-actions">
            <a routerLink="/settings" class="btn ghost">← Settings</a>
            <button class="btn primary" type="button" (click)="saveChanges()" [disabled]="!dirty()">
              Save changes
            </button>
          </div>
        </div>
        @if (saveState() === 'saved') {
          <div class="save-indicator">Saved ✓</div>
        }
      </header>

      <div class="appearance-layout">
        <aside class="scope-nav">
          @for (scope of scopes; track scope) {
            <button
              type="button"
              (click)="selectScope(scope.id)"
              [class.active]="selectedScope() === scope.id"
            >
              <div class="scope-head">
                <span>{{ scope.label }}</span>
                @if (scope.badge) {
                  <span class="badge">{{ scope.badge }}</span>
                }
              </div>
              <p>{{ scope.description }}</p>
            </button>
          }
        </aside>

        <section class="editor">
          <header class="editor-head">
            <div>
              <h2>{{ currentScopeMeta()?.label }}</h2>
              <p>{{ currentScopeMeta()?.description }}</p>
            </div>
            <div class="editor-actions">
              <button
                type="button"
                class="btn ghost sm"
                (click)="resetScope()"
                [disabled]="!scopeHasOverrides()"
              >
                Reset scope
              </button>
              <button type="button" class="btn ghost sm" (click)="resetAll()" [disabled]="!dirty()">
                Reset all
              </button>
            </div>
          </header>

          <div class="token-grid">
            @for (token of tokensForScope(); track token) {
              <article class="token-card">
                <div class="token-copy">
                  <h3>{{ token.label }}</h3>
                  <p>{{ token.description }}</p>
                </div>
                <div class="token-controls">
                  <input
                    class="color-chip"
                    type="color"
                    [value]="colorFor(token.id)"
                    (input)="updateColor(token.id, $any($event.target).value)"
                  />
                  <span class="hex">{{ colorFor(token.id) }}</span>
                  @if (hasOverride(token.id)) {
                    <button type="button" class="btn ghost xs" (click)="resetToken(token.id)">
                      Reset
                    </button>
                  }
                </div>
              </article>
            }
          </div>

          <footer class="save-bar">
            @if (dirty() && saveState() !== 'saved') {
              <span>Unsaved changes</span>
            }
            @if (saveState() === 'saved') {
              <span class="saved">Synced — ready to use.</span>
            }
            <button class="btn primary" type="button" (click)="saveChanges()" [disabled]="!dirty()">
              Save changes
            </button>
          </footer>
        </section>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: auto;
        background: rgb(var(--bg0));
      }

      .appearance-page {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding: 2rem clamp(1rem, 3vw, 2.5rem);
        color: rgb(var(--fg));
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        background: linear-gradient(135deg, rgba(var(--primary), 0.16), rgba(var(--primary), 0.05));
        border: 1px solid rgba(var(--primary), 0.45);
        border-radius: 18px;
        padding: clamp(1.5rem, 4vw, 2.5rem);
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
        gap: 1rem;
      }

      .hero-text h1 {
        margin: 0.25rem 0 0.5rem;
        font-size: clamp(1.75rem, 3vw, 2.5rem);
      }

      .eyebrow {
        margin: 0;
        font-size: 0.85rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(var(--fg), 0.7);
      }

      .hero-sub {
        margin: 0;
        max-width: 640px;
        color: rgba(var(--fg), 0.75);
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }

      .save-indicator {
        font-size: 0.95rem;
        font-weight: 600;
        color: rgb(var(--fg));
      }

      .appearance-layout {
        display: grid;
        grid-template-columns: minmax(220px, 280px) 1fr;
        gap: 1.5rem;
        align-items: flex-start;
      }

      .scope-nav {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .scope-nav button {
        text-align: left;
        border-radius: 14px;
        border: 1px solid rgba(var(--border), 0.8);
        background: rgba(var(--surface), 0.9);
        color: rgb(var(--fg));
        padding: 0.9rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        transition:
          border-color 0.2s ease,
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }

      .scope-nav button.active {
        border-color: rgba(var(--primary), 0.8);
        box-shadow: 0 12px 30px rgba(var(--primary), 0.2);
        transform: translateX(4px);
        background: linear-gradient(135deg, rgba(var(--primary), 0.15), rgba(var(--primary), 0.05));
      }

      .scope-nav p {
        margin: 0;
        font-size: 0.82rem;
        color: rgba(var(--fg), 0.62);
      }

      .scope-head {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        font-weight: 600;
        font-size: 0.95rem;
      }

      .scope-head .badge {
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        border: 1px solid rgba(var(--primary), 0.4);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .editor {
        background: rgba(var(--surface), 0.92);
        border: 1px solid rgba(var(--border-strong), 0.5);
        border-radius: 18px;
        padding: 1.5rem;
        box-shadow: 0 35px 65px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .editor-head {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .editor-head h2 {
        margin: 0 0 0.25rem;
      }

      .editor-head p {
        margin: 0;
        color: rgba(var(--fg), 0.7);
      }

      .editor-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .token-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .token-card {
        border: 1px solid rgba(var(--border), 0.8);
        border-radius: 14px;
        padding: 1rem;
        background: rgba(var(--bg1), 0.85);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-height: 150px;
      }

      .token-copy h3 {
        margin: 0;
        font-size: 1rem;
      }

      .token-copy p {
        margin: 0;
        font-size: 0.85rem;
        color: rgba(var(--fg), 0.65);
      }

      .token-controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .color-chip {
        border: none;
        width: 48px;
        height: 32px;
        border-radius: 6px;
        background: transparent;
        padding: 0;
        cursor: pointer;
      }

      .hex {
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.85rem;
        color: rgba(var(--fg), 0.9);
      }

      .save-bar {
        margin-top: 0.5rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(var(--border), 0.4);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .save-bar span {
        font-size: 0.9rem;
        color: rgba(var(--fg), 0.7);
      }

      .save-bar .saved {
        color: rgba(var(--primary), 0.9);
        font-weight: 600;
      }

      .btn {
        border-radius: 999px;
        padding: 0.55rem 1.35rem;
        font-weight: 600;
        border: 1px solid transparent;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }

      .btn.primary {
        background: linear-gradient(125deg, rgba(var(--primary), 0.9), rgba(var(--primary), 0.7));
        border-color: rgba(var(--primary), 0.8);
        color: #0f0f0f;
        box-shadow: 0 12px 30px rgba(var(--primary), 0.25);
      }

      .btn.primary:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        box-shadow: none;
      }

      .btn.ghost {
        border-color: rgba(var(--border), 0.7);
        color: rgb(var(--fg));
        background: transparent;
      }

      .btn.ghost.sm {
        padding: 0.35rem 0.9rem;
        font-size: 0.85rem;
      }

      .btn.ghost.xs {
        padding: 0.25rem 0.65rem;
        font-size: 0.75rem;
      }

      .btn:not(:disabled):hover {
        transform: translateY(-1px);
      }

      @media (max-width: 1024px) {
        .appearance-layout {
          grid-template-columns: 1fr;
        }

        .scope-nav {
          flex-direction: row;
          overflow-x: auto;
        }

        .scope-nav button {
          min-width: 220px;
        }
      }

      @media (max-width: 640px) {
        .hero {
          flex-direction: column;
        }

        .hero-actions {
          flex-direction: column;
        }

        .editor-actions {
          width: 100%;
          justify-content: space-between;
        }

        .token-controls {
          flex-wrap: wrap;
        }
      }
    `
  ]
})
export class ThemeAppearanceComponent implements OnDestroy {
  readonly scopes = THEME_SCOPE_META;
  readonly tokens = THEME_TOKENS;
  readonly selectedScope = signal<ThemeScope>('root');
  private readonly savedOverrides = signal<ThemeOverrides>(
    cloneThemeOverrides(loadThemeOverrides())
  );
  readonly workingOverrides = signal<ThemeOverrides>(cloneThemeOverrides(this.savedOverrides()));
  readonly saveState = signal<'idle' | 'saved'>('idle');

  readonly tokensForScope = computed(() => this.tokens[this.selectedScope()]);
  readonly currentScopeMeta = computed(() => this.scopes.find(s => s.id === this.selectedScope()));
  readonly dirty = computed(
    () => JSON.stringify(this.workingOverrides()) !== JSON.stringify(this.savedOverrides())
  );

  constructor() {
    applyThemeOverrides(this.workingOverrides());
  }

  selectScope(scope: ThemeScope): void {
    this.selectedScope.set(scope);
  }

  colorFor(token: ThemeTokenId): string {
    return effectiveHex(this.selectedScope(), token, this.workingOverrides());
  }

  updateColor(token: ThemeTokenId, value: string): void {
    const hex = normalizeHex(value);
    this.workingOverrides.update(current => {
      const next = cloneThemeOverrides(current);
      next[this.selectedScope()] = next[this.selectedScope()] ?? {};
      next[this.selectedScope()]![token] = hex;
      return next;
    });
    this.saveState.set('idle');
    applyThemeOverrides(this.workingOverrides());
  }

  hasOverride(token: ThemeTokenId): boolean {
    return Boolean(this.workingOverrides()[this.selectedScope()]?.[token]);
  }

  scopeHasOverrides(): boolean {
    return Boolean(this.workingOverrides()[this.selectedScope()]);
  }

  resetToken(token: ThemeTokenId): void {
    const next = removeTokenOverride(this.workingOverrides(), this.selectedScope(), token);
    this.workingOverrides.set(next);
    this.saveState.set('idle');
    applyThemeOverrides(this.workingOverrides());
  }

  resetScope(): void {
    this.workingOverrides.update(current => {
      const next = cloneThemeOverrides(current);
      delete next[this.selectedScope()];
      return next;
    });
    this.saveState.set('idle');
    applyThemeOverrides(this.workingOverrides());
  }

  resetAll(): void {
    this.workingOverrides.set({});
    this.saveState.set('idle');
    applyThemeOverrides(this.workingOverrides());
  }

  saveChanges(): void {
    const snapshot = cloneThemeOverrides(this.workingOverrides());
    this.savedOverrides.set(snapshot);
    saveThemeOverrides(snapshot);
    applyThemeOverrides(snapshot);
    this.saveState.set('saved');
    setTimeout(() => this.saveState.set('idle'), 2400);
  }

  ngOnDestroy(): void {
    applyThemeOverrides(this.savedOverrides());
  }
}
