# Clean Architecture Guide

This project enforces Clean Architecture through executable guards.
Conventions are not optional; CI and local checks enforce them.

## Scope

Architecture rules apply under `src/app`, with strongest enforcement in:

- `src/app/features/**`
- `src/app/core/**`
- `src/app/shared/**`
- `src/app/platform/**`

## Required Feature Structure

Each top-level feature context in `src/app/features/<context>` must contain:

- `application/`
- `domain/`
- `infrastructure/`
- `presentation/`

Allowed file at feature root: `index.ts` only.

## Feature Layer Dependency Direction

Enforced by `scripts/dependency-layer-guard.cjs`:

- `domain` -> `domain`
- `application` -> `application`, `domain`
- `infrastructure` -> `infrastructure`, `application`, `domain`
- `presentation` -> `presentation`, `infrastructure`, `application`, `domain`

Additional restrictions:

- `domain` and `application` cannot import Angular/platform/infrastructure APIs.
- `domain` and `application` cannot use browser globals (`window`, `document`, `localStorage`, `navigator`).
- Non-auth features cannot import from `src/app/auth/**`.

## Top-Level Zone Boundaries

Enforced by `scripts/architecture-guard.cjs`:

- `core` must stay isolated (`core` + neutral/other only).
- `shared` can depend on `shared`, `platform`, `infrastructure`, `core`.
- `features` can depend on `features`, `infrastructure`, `core`, `shared`, `auth`.
- `platform` can depend on `platform`, `infrastructure`, `core`, `shared`.
- `app` root files are composition-only.

## Forbidden Legacy Paths

Hard-fail conditions include:

- any runtime or import reference to `src/app/pages/**`
- reintroducing legacy feature wrappers/compat files
- reintroducing forbidden root artifacts and duplicate deprecated configs

## Required Commands

Use these commands before merge:

```bash
npm run architecture:check
npm run architecture:health
npm run typecheck
npm run lint
npm run test -- --watch=false
npm run build:prod
```

For full pipeline execution:

```bash
npm run verify:quick
npm run verify:all
```

`npm run verify:quick` includes `build:prod` and `verify:deploy-build`.
`npm run verify:all` still finishes with a final `build:prod` and
`verify:deploy-build`, so the pipeline ends with a deploy-ready hashed
production bundle in `dist`.
