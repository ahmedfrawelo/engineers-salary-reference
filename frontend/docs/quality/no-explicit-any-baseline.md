# Explicit Any Baseline

Date: 2026-02-07
Scope: `src/app/**/*.ts` (excluding `*.spec.ts`, `*.test.ts`)

Historical note:
This baseline is a migration snapshot and is retained for comparison only.
Current category names and budgets are defined by the live guard script.

## Baseline Budgets

- Total explicit-any budget: `0`
- `core`: `0`
- `shared`: `0`
- `pages`: `0`
- `auth`: `0`
- `app-root`: `0`
- `suppliers-scope`: `0`
- `data-grid-scope`: `0`

## Guard Policy

- Guard script: `scripts/no-explicit-any-guard.cjs`
- Report output: `docs/quality/no-explicit-any-report.md`
- `verify:quick` fails if any explicit-any usage appears.
- Budgets are strict-zero to prevent regressions.
