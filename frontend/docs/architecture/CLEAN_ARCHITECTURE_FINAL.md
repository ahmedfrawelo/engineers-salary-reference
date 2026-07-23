# Clean Architecture - Final Strict State

## Final Status (2026-02-12)

Last reviewed: 2026-03-06

1. Runtime routes load from `src/app/features/*/presentation` only.
2. All `presentation/legacy`, `infrastructure/legacy`, `*.route-compat.component.ts`, and bridge wrappers were removed from `features`.
3. `src/app/pages` was removed from the application tree.
4. Backend endpoints and payload contracts remain unchanged.

## Enforced Boundaries

1. `domain` and `application` are framework-agnostic and isolated from Angular/DOM/storage/network details.
2. External integration flows through `application ports` + `infrastructure adapters`.
3. `presentation` is limited to UI orchestration/state/wiring.
4. Framework-specific runtime wiring is isolated under `src/app/platform/angular`.

## Target Structure (Implemented)

- `src/app/features/<context>/<feature>/domain`
- `src/app/features/<context>/<feature>/application`
- `src/app/features/<context>/<feature>/infrastructure`
- `src/app/features/<context>/<feature>/presentation`
- `src/app/shared-kernel/*`
- `src/app/platform/angular/*`

## Hard Gates

`npm run architecture:check` runs strict guards with:

- `scripts/architecture-guard.cjs`
- `scripts/pages-runtime-usage-guard.cjs` (strict mode)
- `scripts/legacy-elimination-guard.cjs` (strict mode)
- `scripts/dependency-layer-guard.cjs`

The gates fail on:

1. Layer violations and dependency reversals.
2. Angular/HTTP/DOM/storage leakage into `domain` or `application`.
3. Runtime imports to `src/app/pages/**`.
4. Reintroduction of legacy wrappers/components/files.

## Context Completion

1. Tender: `dashboard`, `projects`, `suppliers`, `tasks`, `pricing`, `reports`, `boq`.
2. Settings: including `material-codes` and context routes under feature presentation.
3. Auth/Account/Operations/CRM/HR/In-hand/Stores routed via feature presentation entrypoints.
4. Shared complex modules hardened with domain-facing policies (`calendar`, `data-grid`).

## Verification Snapshot

1. `npm run architecture:check` passed in strict mode.
2. `npm run build:prod` passed.
3. `npm run verify:quick` passed.
