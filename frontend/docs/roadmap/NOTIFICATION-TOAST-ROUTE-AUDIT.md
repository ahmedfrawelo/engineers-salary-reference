# Notification And Toast Route Audit

Date: 2026-04-08

## Scope

This audit walks the routed frontend surface area defined in:

- `src/app/app.routes.ts`
- `src/app/features/account/presentation/routes.ts`
- `src/app/features/auth/presentation/auth.routes.ts`
- `src/app/features/crm/presentation/routes.ts`
- `src/app/features/hr/presentation/routes.ts`
- `src/app/features/in-hand/presentation/routes.ts`
- `src/app/features/operations/presentation/routes.ts`
- `src/app/features/settings/presentation/routes.ts`
- `src/app/features/stores/presentation/routes.ts`
- `src/app/features/tasks/presentation/routes.ts`
- `src/app/features/tender/presentation/routes.ts`
- `src/app/features/tender/reports/presentation/routes.ts`
- `src/app/features/tender/suppliers/presentation/suppliers-feature.routes.ts`

It also checks page-adjacent panels and heavy sub-surfaces under those routes for:

- local toast markup
- local toast state and timers
- alternate toast or notification services
- browser `alert` / `confirm` dialogs in page code
- browser notification entry points outside the shared notification center

## Global Result

- One global toast container is mounted in `src/app/app.component.html`.
- One toast implementation is used: `src/app/core/notifications/toast.service.ts`, re-exported by `src/app/shared/toast/toast.service.ts`.
- One notification center is used: `src/app/core/notifications/notification-center.service.ts`.
- One realtime-to-UI bridge is used: `src/app/platform/angular/notifications/notifications-bridge.service.ts`.
- The two notification UI surfaces, header preview and account inbox, share one presentation layer: `src/app/core/notifications/utils/notification-presentation.util.ts`.
- No parallel `MatSnackBar`, `ngx-toastr`, alternate browser-notification service, or second toast component was found under `src/app`.
- A legacy inline toast renderer that still existed inside `src/app/features/tender/projects/presentation/page/tender-projects.component.html` was removed, so `Tender Projects` now emits through the shared `ToastService` instead of a route-local toast surface.
- A second route-local undo surface that still existed inside `src/app/features/tender/projects/presentation/page/tender-project-details/tabs/overview-tab.component.html` was removed, so checklist delete undo now uses the shared global toast action instead of inline route markup and timers.
- `DataGrid` feedback is routed through the shared toast system and no longer falls back to browser `alert/confirm` dialogs.
- `DataGrid` transient autosave and copy feedback is emitted through the shared global toast stack; the route-local `auto-save-indicator` surface was removed.
- The shared browser notification entry point remains `src/app/core/notifications/notification-center.service.ts` only.
- Dead local `.toast` styling and unreachable inline undo markup were removed from `src/app/features/settings/material-classification/presentation/page/panels/add-material-panel/add-material-panel.component.scss` and `src/app/features/settings/material-classification/presentation/page/panels/add-material-panel/add-material-panel.component.html` to avoid future style collisions and alternate feedback renderers.

## Method

- Enumerated the routed page surface from the route files listed above.
- Scanned `src/app` for:
  - `ToastService`, `UndoActionToastService`
  - `NotificationCenterService`, `NotificationsBridgeService`
  - local `toasts` arrays and `toastId` counters
  - toast markup such as `<div class="toasts">`
  - direct `confirm()` / `alert()` usage
  - browser `Notification` API usage
- Manually followed high-risk surfaces:
  - `Tender Projects`
  - `Tender Project Details / Overview Tab`
  - `Tender Suppliers`
  - `Tender Settings`
  - `DataGrid`
  - `Material Classification` panel wrappers

## Route Audit

### Auth

- `login`
- `signup`
- Result: no parallel notification or toast implementation detected. Auth and HTTP failures resolve through the shared toast pipeline.

### Dashboard

- `dashboard`
- Result: no route-local notification system detected. The page uses the shared app shell notification and toast infrastructure only.

### Account

- `account/profile`
- `account/settings`
- `account/notifications`
- Result: unified. `account/notifications` is the full inbox surface and shares the same notification presentation helpers as the shell dropdown.

### CRM

- `crm/companies`
- `crm/companies/:id`
- `crm/contacts`
- `crm/contacts/:id`
- `crm/deals`
- `crm/deals/:id`
- `crm/reports`
- Result: unified. CRUD-heavy screens use `ToastService` and `UndoActionToastService`; no alternate design surface was found.

### HR

- `hr/leave`
- `hr/attendance`
- `hr/recruitment`
- `hr/payroll`
- `hr/compliance`
- Result: unified. `hr/leave` is fully wired to shared toast and undo flows. The remaining routed pages do not introduce a second notification or toast system.

### In-Hand

- `in-hand/document-control/*`
- `in-hand/stores/*`
- `in-hand/procurement/*`
- `in-hand/daily/*`
- `in-hand/cost/*`
- `in-hand/meetings/*`
- Result: unified. Stores action pages use shared toast and undo flows. The remaining routed pages do not define an alternate notification or toast implementation.

### Stores Alias

- `stores/*`
- Result: route alias only. It redirects to the same `in-hand/stores/*` pages and therefore shares the same toast and notification stack.

### Operations

- `operations/billing`
- `operations/hse`
- `operations/analytics`
- Result: no alternate notification or toast implementation detected.

### Settings

- `settings`
- `settings/material-classification`
- `settings/access-control/*`
- `settings/appearance`
- `settings/active-sessions`
- Result: unified. CRUD-heavy settings pages use shared toast and undo infrastructure. No second notification or toast design surface was found.
- Verified wrappers:
  - `add-material-panel.component.presenter.utility.base.ts`
  - `schema-builder.component.ts`
  These wrappers dispatch into the shared `ToastService`; they are not alternate renderers.
- Removed dead local `.toast` CSS and unreachable inline undo markup from `add-material-panel.component.*` so this panel no longer carries stale toast-specific naming or alternate feedback UI.

### Tasks

- `tasks`
- Result: unified. The workspace uses shared `ToastService` and `UndoActionToastService`.

### Tender

- `tender/projects`
- `tender/suppliers`
- `tender/suppliers/settings`
- `tender/pricing`
- `tender/boq`
- `tender/boq/project-breakdown/:id`
- `tender/reports/*`
- Result: unified. Tender CRUD and reporting surfaces use the shared toast stack, and server notifications enter through the shared bridge and notification center only.
- `Tender Projects`:
  - removed route-local toast markup from `tender-projects.component.html`
  - removed route-local toast state from `tender-projects.component.state.ts`
  - rerouted presenter notifications through shared `ToastService` in `tender-projects.component.presenter.core.ts`
  - removed route-local checklist undo toast markup and timers from `tender-project-details/tabs/overview-tab.component.*`
  - replaced direct `confirm()` in `tender-project-settings/tender-settings.component.ts` with shared toast action confirmation
- `Tender Suppliers`:
  - audited `tender-suppliers.component.state.ts`, `tender-suppliers.persistence.core.ts`, `tender-suppliers.list.internal.ts`, `editor/add-supplier-panel/add-supplier-panel.component.impl.ts`, and settings surfaces
  - confirmed these use shared `ToastService` / `UndoActionToastService`
  - no alternate renderer or browser dialog path found

## Page-By-Page Coverage

### Account

- `account/profile`
  - audited `account-profile-page.component`
  - no local toast renderer found
- `account/settings`
  - audited `account-settings-page.component`
  - no local toast renderer found
- `account/notifications`
  - audited `account-notifications-page.component`
  - uses the shared notification center and shared presentation utilities only

### CRM

- `crm/companies`
  - audited `companies-list.component`
  - uses shared `ToastService` and `UndoActionToastService`
- `crm/companies/:id`
  - audited `company-record.component` and its action panels
  - uses shared `ToastService` and `UndoActionToastService`
- `crm/contacts`
  - audited `contacts-list.component`
  - uses shared toast services only
- `crm/contacts/:id`
  - audited `contact-record.component`
  - uses shared toast services only
- `crm/deals`
  - audited `deals-kanban.component`
  - uses shared toast services only
- `crm/deals/:id`
  - audited `deal-record.component`
  - uses shared toast services only
- `crm/reports`
  - audited `reports-kpis.component`
  - no alternate notification UI found

### HR

- `hr/leave`
  - audited `hr-leave-page.component.impl.ts`
  - uses shared `ToastService` and `UndoActionToastService`
- `hr/attendance`
  - audited `hr-attendance-page.component`
  - no alternate notification UI found
- `hr/recruitment`
  - audited `hr-recruitment-page.component`
  - no alternate notification UI found
- `hr/payroll`
  - audited `hr-payroll-page.component`
  - no alternate notification UI found
- `hr/compliance`
  - audited `hr-compliance-page.component`
  - no alternate notification UI found

### In-Hand

- `in-hand/document-control/*`
  - audited routed page surfaces under `page/document-control`
  - no alternate notification renderer found
- `in-hand/stores/goods-receipts`
  - audited `goods-receipts.page`
  - no alternate notification renderer found
- `in-hand/stores/stock`
  - audited `stock.component`
  - no alternate notification renderer found
- `in-hand/stores/issues-returns`
  - audited `issues-returns.component`
  - no alternate notification renderer found
- `in-hand/stores/receive-items`
  - audited `receive-items.page`
  - uses shared `ToastService` and `UndoActionToastService`
- `in-hand/stores/issue-items`
  - audited `issue-items.page`
  - uses shared `ToastService` and `UndoActionToastService`
- `in-hand/stores/adjust-inventory`
  - audited `adjust-inventory.page`
  - uses shared `ToastService` and `UndoActionToastService`
- `in-hand/procurement/*`
  - audited routed procurement page surfaces
  - no alternate notification renderer found
- `in-hand/daily/*`
  - audited routed daily page surfaces
  - no alternate notification renderer found
- `in-hand/cost/*`
  - audited routed cost page surfaces
  - no alternate notification renderer found
- `in-hand/meetings/*`
  - audited routed meetings page surfaces
  - no alternate notification renderer found

### Operations

- `operations/billing`
  - audited `billing-page.component`
  - no alternate notification renderer found
- `operations/hse`
  - audited `hse-page.component`
  - no alternate notification renderer found
- `operations/analytics`
  - audited `analytics-page.component`
  - no alternate notification renderer found

### Settings

- `settings`
  - audited `settings.component`
  - no alternate notification renderer found
- `settings/material-classification`
  - audited `material-classification.component.core.ts`
  - audited panels:
    - `add-material-panel`
    - `masters-panel`
    - `schema-builder`
  - all toast wrappers dispatch into shared `ToastService`
- `settings/access-control`
  - audited `user-access-control.component` and module declarations
  - uses shared `ToastService` and `UndoActionToastService`
- `settings/appearance`
  - audited `theme-appearance.component`
  - no alternate notification renderer found
- `settings/active-sessions`
  - audited `active-sessions.component`
  - no alternate notification renderer found

### Tasks

- `tasks`
  - audited `task-future-feature-page.component` and task workspace bases
  - uses shared `ToastService` and `UndoActionToastService`

### Tender Projects

- `tender/projects`
  - audited `tender-projects-feature-page.component`
  - audited `tender-projects.component`
  - audited sub-surfaces:
    - `tender-project-details`
    - `add-tender-panel`
    - `tender-project-settings`
    - activity helpers and fetch helpers
  - removed the legacy route-local toast renderer and route-local toast state
  - removed the checklist-level inline `undo-toast` in `overview-tab.component.*`
  - replaced the direct browser confirm in `tender-project-settings`
- `tender/projects` route now uses the shared toast stack only

### Tender Suppliers

- `tender/suppliers`
  - audited `suppliers-feature-page.component`
  - audited `tender-suppliers.component`
  - audited sub-surfaces:
    - `add-supplier-panel`
    - supplier editor overlays
    - supplier details overlays
    - delete confirm overlay
    - dossier/mail preview overlays
    - supplier settings panel/page
  - no alternate toast renderer or browser dialog path found
- `tender/suppliers/settings`
  - audited `supplier-settings-page.component` and `supplier-settings-panel.component`
  - notifications text here is informational only; it does not introduce a second notification stack

### Tender Pricing

- `tender/pricing`
  - audited `tender-pricing.component`
  - uses shared `UndoActionToastService`

### Tender BOQ

- `tender/boq`
  - audited `tender-boq-feature-page.component`
  - no alternate notification renderer found
- `tender/boq/project-breakdown/:id`
  - audited `project-breakdown.component.impl.ts`
  - uses shared `UndoActionToastService`

### Tender Reports

- `tender/reports`
- `tender/reports/pipeline-health`
- `tender/reports/projects`
- `tender/reports/suppliers`
- `tender/reports/pricing`
- `tender/reports/boq`
- `tender/reports/cost-control`
- `tender/reports/supplier-performance`
  - audited routed report page surfaces
  - no alternate toast or notification renderer found

## Residual Notes

- A commented-out `alert(...)` note remains in `features/tender/suppliers/presentation/page/suppliers-mail.service.ts`; it is not executable code and does not affect runtime behavior.
- `NotificationCenterService` still uses the browser `Notification` API by design, but it is the single shared implementation and not a second notification stack.

## Conclusion

- Routed pages are on one notification system and one toast system.
- The notification design surface is unified across shell preview and inbox.
- No parallel toast library or parallel notification presentation stack was found.
- The remaining confidence gap is runtime UAT only, not code-level fragmentation.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm run verify:quick`
