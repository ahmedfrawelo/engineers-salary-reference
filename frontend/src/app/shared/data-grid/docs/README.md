# ENGINEERS_SALARY_REFERENCE DataGrid

Shared grid package for ENGINEERS_SALARY_REFERENCE Portal.

## Package Layout

- `index.ts`
  Public API entrypoint. External consumers should import from `@shared/data-grid` only.
- `component/`
  Public Angular component entrypoint and its colocated template, styles, and spec.
- `models/`
  Public contracts and shared types.
- `components/`
  Internal UI subcomponents such as menus, panels, footer widgets, and loaders.
- `core/`
  Presenter, state, and runtime logic.
- `renderers/`
  Cell renderers and rendering directives.
- `services/`
  Grid-scoped services such as export, keyboard navigation, formulas, and performance tracking.
- `styles/`
  Shared visual system for the unified grid shell.
- `utils/`
  Public-safe utilities and package-local helpers.
- `internal/`
  Narrow compatibility re-exports for runtime domains.
- `docs/`
  Package documentation.

## Design Rules

- The package owns grid shell design, runtime behavior, and internal DOM contracts.
- Feature pages own only columns, row data, business renderers, and feature actions.
- Do not import package internals from outside the package.
- Do not add page-specific shell styling outside `src/app/shared/data-grid`.
- Keep root-level files minimal. `index.ts` is the only package entrypoint kept at the root.

## Public Surface

Import from:

```ts
import { DataGridComponent, type GridColumn, type GridConfig } from '@shared/data-grid';
```

Public surface includes:

- `DataGridComponent`
- public models from `models/`
- public services exported by `index.ts`
- renderers exported by `index.ts`
- public DOM helper `resolveDataGridMainScrollHost`

## Maintenance Rules

- New shell-level styling belongs in `styles/`.
- New sub-UI pieces belong in `components/`.
- New runtime logic belongs in `core/runtime/`.
- New presenter/state logic belongs in `core/presenter/` or `core/`.
- New public contracts belong in `models/`.
- New docs belong in `docs/`.

## Worklog

See:

- `../../../../../docs/architecture/DATA_GRID_WORKLOG.md`

## Theming

See:

- `../../../../../docs/architecture/DATA_GRID_THEMING.md`

## Current Architecture

- One unified grid shell design.
- One package-level source of truth for layout, outlines, hover, scroll, header, body, and footer behavior.
- No page-owned grid shell styling.
- No external imports to internal package files.
