# Baseline Clean Architecture Report

Date: 2026-02-07
Scope: `src/app`, architecture scripts, quality gates

Historical note:
This is a baseline snapshot captured on 2026-02-07 for migration tracking.
It is not the live source of truth for current metrics.

## Snapshot Metrics

- lint warnings: `0` (`0` errors)
- explicit-any usages: `0`
- legacy component/internal backlog: `7`
- legacy helper backlog: `0`
- wrapper backlog: `0`

## Gate Status (Baseline)

- `npm run verify:quick`: Passed
- `npm run verify:all`: Passed
- `npm run architecture:check`: Passed
- `npm run architecture:health`: Passed
- `npm run complexity-report`: Passed
- `npm run typecheck`: Passed
- `npm run lint`: Passed
- `npm run test -- --watch=false`: Passed
- `npm run build:prod`: Passed

## Largest TypeScript Files (Top 10)

1. `src/app/pages/tender/suppliers/tender-suppliers.component.ts` - 2994
2. `src/app/shared/ui/calendar.component.ts` - 2982
3. `src/app/shared/data-grid/data-grid.component.ts` - 2981
4. `src/app/pages/tender/dashboard/tender-dashboard.component.ts` - 2978
5. `src/app/pages/settings/material-codes/panels/add-material-panel/add-material-panel.component.ts` - 2914
6. `src/app/pages/settings/user-access-control/user-access-control.component.ts` - 2896
7. `src/app/pages/tender/projects/tender-projects.component.ts` - 2804
8. `src/app/pages/tender/tasks/tender-tasks.component.ts` - 1499
9. `src/app/pages/tender/projects/tender-project-details/project-details.component.ts` - 1480
10. `src/app/auth/login.component.ts` - 1423

## Type Safety Baseline

- `@ts-nocheck`: none in `src/app`.
- `tsconfig.app.json`: `noImplicitAny` is `true`.
- explicit-any baseline is enforced by `scripts/no-explicit-any-guard.cjs`.

## Architecture Baseline Notes

1. Layer guard is active and passing (`core/shared/pages/auth` boundaries).
2. Temporary naming guard is active and passing (`.refactor`, `.temp`, copy-like temp names).
3. Wrapper-only `*.component.ts` backlog is closed (`0` tracked).
4. Helper legacy backlog is closed (`0`) and helper allowlists were removed.
5. Explicit-any guard baseline is now strict zero (`0`) across all scopes.
6. Inline template/style extraction and helper decomposition waves reduced component backlog from `20` to `7`.

## Baseline Acceptance Reference

Post-refactor acceptance compares against this baseline. The target state requires:

- explicit-any is now closed at `0` and must remain `0`,
- reducing large-file legacy backlog from `7 + 0` toward `0`,
- removing remaining legacy allowlists,
- full gate stability with unchanged product behavior.
