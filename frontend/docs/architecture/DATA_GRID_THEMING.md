# DataGrid Theming

Last updated: `2026-04-01`

This document defines the theming source of truth for `DataGrid`.

## Goal

The grid should follow the active app theme automatically.

That means:

- no page-owned shell colors
- no dark-only fallback skin in grid chrome
- no page-specific theme overrides outside `DataGrid`
- one token layer that all grid shell pieces consume

## Source Of Truth

Primary token entrypoint:

- `src/app/shared/data-grid/styles/base/_theme-and-base.scss`

Main shell consumers:

- `src/app/shared/data-grid/styles/shell/`
- `src/app/shared/data-grid/styles/base/_core-visuals.scss`
- `src/app/shared/data-grid/styles/structure/`
- `src/app/shared/data-grid/components/footer/grid-calculate-footer.component.scss`

## Token Layers

### App tokens

These come from the global app theme and are treated as upstream inputs:

- `--app-color-panel-body`
- `--app-color-panel-body-text`
- `--app-color-panel-subheading`
- `--app-color-control-bg`
- `--app-color-control-border`
- `--app-color-overlay-body`
- `--app-color-divider`
- `--app-color-primary-*`
- `--app-color-success-*`
- `--app-color-warning-*`
- `--app-color-danger-*`

### DataGrid semantic tokens

These are the internal grid tokens that shell styles should use:

- surface:
  - `--dg-bg-base`
  - `--dg-bg-header`
  - `--dg-bg-surface`
  - `--dg-bg-muted`
  - `--dg-bg-strong`
- text:
  - `--dg-fg-strong`
  - `--dg-fg-soft`
  - `--dg-fg-muted`
- borders:
  - `--dg-border`
  - `--dg-border-strong`
- overlays:
  - `--dg-overlay-bg`
  - `--dg-overlay-bg-strong`
  - `--dg-overlay-subtle`
  - `--dg-overlay-border`
  - `--dg-overlay-divider`
  - `--dg-overlay-shadow`
- controls:
  - `--dg-control-bg`
  - `--dg-control-bg-strong`
  - `--dg-control-border`
  - `--dg-control-border-strong`
  - `--dg-control-text`
  - `--dg-control-placeholder`
- chrome helpers:
  - `--dg-floating-toolbar-bg`
  - `--dg-floating-toolbar-border`
  - `--dg-floating-toolbar-shadow`
  - `--dg-bottom-bar-bg`
  - `--dg-bottom-bar-border`
- state tokens:
  - `--dg-hover`
  - `--dg-selected`
  - `--dg-primary-*`
  - `--dg-info-*`
  - `--dg-success-*`
  - `--dg-warning-*`
  - `--dg-danger-*`

## Rules

- Shell-level styling must consume `--dg-*` semantic tokens, not raw page colors.
- When a new grid surface appears, add a semantic token in `_theme-and-base.scss` first.
- Do not hardcode dark backgrounds for:
  - selection cells
  - sticky pinned cells
  - hover toolbars
  - filter rows
  - column chooser
  - footer or pagination strips
- Feature pages can customize content renderers, but not shell theme ownership.

## Testing

Theme regression coverage exists in:

- `e2e/data-grid-theme.spec.ts`

Current regression scope:

- `Tender Projects` in light theme
- `Suppliers` in light theme

These tests assert that header, body, selection cells, and footer render with light backgrounds when the app theme is light.

## Safe Customization Path

If you want to customize the grid later:

1. start from `_theme-and-base.scss`
2. add or adjust semantic `--dg-*` tokens
3. consume those tokens in shell/base/structure files
4. avoid page-owned shell overrides

This keeps the grid theme-compatible across light and dark modes.
