# Clean Architecture 100% Roadmap

Historical note:
This roadmap documents the migration plan and closure record.
For current enforced rules, use `docs/CLEAN_ARCHITECTURE_GUIDE.md`.

## Objective

Close migration on strict Clean Architecture with:

1. No runtime dependency on `src/app/pages/**`.
2. No legacy wrappers/adapters/route-compat files inside `features`.
3. All business rules isolated in `domain/application`.
4. Hard gates preventing any architectural regression.

## Snapshot Strategy

- External safety snapshots were maintained under `../copy/clean-arch-*`.
- Final closure wave completed on **2026-02-12**.
- Final strict snapshot: `../copy/clean-arch-final-20260212-151207`.

## Phase Status

### Phase 0 - Safety + Baseline

- [x] Snapshot-first execution adopted.
- [x] Baseline verification gates established.

### Phase 1 - Foundation

- [x] `shared-kernel` foundation established.
- [x] strict aliases and dependency guards configured.
- [x] pages-runtime and legacy-elimination guards integrated.

### Phase 2 - Pilot: Tender Suppliers

- [x] full layered structure implemented.
- [x] ports/use-cases/adapters adopted.
- [x] legacy migration finalized and wrappers removed.

### Phase 3 - Pilot: Settings Material Codes

- [x] full layered structure implemented.
- [x] ports/use-cases/adapters adopted.
- [x] legacy migration finalized and wrappers removed.

### Phase 4 - Shared Complex Components

- [x] calendar policies delegated to domain-facing modules.
- [x] data-grid filter/sort policies delegated to domain-facing modules.

### Phase 5 - Tender Context Completion

- [x] `dashboard/projects/suppliers/tasks/pricing/reports/boq` migrated.
- [x] tender routes now load feature presentation pages directly.
- [x] direct runtime dependence on legacy page wrappers removed.

### Phase 6 - Remaining Contexts

- [x] `settings`, `crm`, `hr`, `in-hand`, `operations`, `stores`, `account`, `auth` moved to feature presentation route entrypoints.
- [x] compatibility wrappers removed.
- [x] legacy runtime paths removed.

### Phase 7 - Core/Platform Finalization

- [x] framework-bound HTTP interceptor stack moved to `src/app/platform/angular/interceptors`.
- [x] platform wiring updated in bootstrap/app config.
- [x] integration boundaries aligned with feature/infrastructure layering.

### Phase 8 - Hardening + Legacy Removal

- [x] deleted route aggregators and transitional wrappers.
- [x] removed `src/app/pages` tree.
- [x] removed legacy route selectors/styles (`legacy-route-*`).
- [x] tightened architecture guard to block `src/app/pages` reintroduction.
- [x] finalized strict architecture docs.

## Final Acceptance

- [x] `npm run architecture:check`
- [x] `npm run architecture:health`
- [x] `npm run verify:quick`
- [x] `npm run build:prod`

## Notes

1. Backend API contracts were preserved with no endpoint/payload changes.
2. User-facing routes remained stable while internal migration completed.
3. Any reintroduction of pages/legacy paths is now blocked by hard gates.
