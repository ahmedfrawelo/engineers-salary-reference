# CRUD Undo Coverage Matrix

**Date:** 2026-04-08
**Scope:** Frontend project-wide audit of `Add / Edit / Delete` feedback coverage
**Basis:** Automated scan of `undoToast.*`, `toast.action(...)`, and focused file review for key feature modules

---

## Legend

- `Full` = `Add / Edit / Delete` are covered with action feedback where applicable
- `Partial` = only part of the CRUD surface is covered
- `Info Only` = standard success/error/warning toasts exist, but no action undo
- `Intentional No Undo` = no undo by design because rollback would be incomplete or misleading
- `No Coverage Detected` = no action-toast coverage detected in the current audit

---

## Shared Infrastructure

| Area | Coverage | Notes |
|------|----------|-------|
| Global action toasts | Full | `ToastService.action(...)` enables action button + progress window |
| Shared undo wrapper | Full | `UndoActionToastService.created/updated/deleted(...)` is the common entry point |
| Progress indicator | Full | Action toasts render a timed progress bar while the undo window is open |
| Data Grid local actions | Full | Local row delete, batch delete, and preset overwrite use action toasts instead of `confirm()` |

---

## Account

| Module | Feature | Add | Edit | Delete | Action Coverage | Status | Notes |
|--------|---------|-----|------|--------|-----------------|--------|-------|
| Account | Notifications page | N/A | Yes | Yes | `Undo`, `Cancel` | Full | Single archive, restore, and delete use action toasts; batch `mark all read` and `archive read` now use rollback-capable action toasts; delete archived keeps a confirm-like `Cancel` action |

---

## HR

| Module | Feature | Add | Edit | Delete | Action Coverage | Status | Notes |
|--------|---------|-----|------|--------|-----------------|--------|-------|
| HR | Leave requests | Yes | Yes | N/A | `Undo` | Full | Local leave request creation and status updates now use undo-backed action toasts; no delete flow is exposed in the current UI |

---

## In-Hand

| Module | Feature | Add | Edit | Delete | Action Coverage | Status | Notes |
|--------|---------|-----|------|--------|-----------------|--------|-------|
| In-Hand | Stores execution actions | Yes | Yes | Yes | `Undo` | Full | Receive, issue, and adjust pages now use undo-backed line add/remove and post-to-register draft restore flows |

---

## CRM

| Module | Feature | Add | Edit | Delete | Action Coverage | Status | Notes |
|--------|---------|-----|------|--------|-----------------|--------|-------|
| CRM | Companies list | Yes | Yes | Yes | `Undo` | Full | Single create/update via `UndoActionToastService`, single/bulk delete via direct `toast.action('Undo')` |
| CRM | Company create page | Yes | N/A | N/A | `Undo` | Full | Create uses undo remove |
| CRM | Company record | Yes | Yes | N/A | `Undo`, action toast | Full | Note add and manual save covered |
| CRM | Company action panels | Yes | N/A | N/A | `Undo` | Full | Note, call, email, meeting, and task creation all use undo |
| CRM | Contacts list | Yes | Yes | Yes | `Undo` | Full | Single and bulk delete covered |
| CRM | Contact record | Yes | Yes | N/A | `Undo`, action toast | Full | Note add and manual save covered |
| CRM | Deals kanban | Yes | Yes | Yes | `Undo` | Full | Single and bulk delete covered |
| CRM | Deal record | Yes | Yes | N/A | `Undo`, action toast | Full | Note add and manual save covered |
| CRM | Tasks list | Yes | Yes | Yes | `Undo` | Full | Create, edit, delete, and status toggle covered |

---

## Tender

| Module | Feature | Add | Edit | Delete | Action Coverage | Status | Notes |
|--------|---------|-----|------|--------|-----------------|--------|-------|
| Tender | Pricing items | Yes | Yes | Yes | `Undo` | Full | Local item create/update/delete covered |
| Tender | Pricing quotes | Yes | Yes | Yes | `Undo` | Full | Quote create/update/delete covered |
| Tender | Pricing preferred quote | N/A | Yes | N/A | `Undo` | Full | Preferred quote switch is reversible |
| Tender | Project settings | Yes | Yes | Yes | `Undo` | Full | Delete is deferred until `onExpire`, with local restore on undo |
| Tender | Projects main page | Yes | Yes | Yes | `Open`, `Undo` | Full | Create uses `Open`; rename, single edit, and bulk edit use API-backed undo; queued delete uses deferred undo |
| Tender | Reports register | Yes | N/A | N/A | `Undo` | Full | Local report creation uses undo remove |
| Tender | Suppliers | Yes | Yes | Yes | `Undo`, `Review` | Full | Create/update/delete are covered; failed saves keep a `Review` action to reopen the editor |
| Tender | BOQ project breakdown | Yes | Yes | Yes | `Undo` | Full | Local import, adopt-unit-rate, row add/remove, duplicate, clipboard paste, and inline cell edits all use undo-backed mutations |

---

## Settings

| Module | Feature | Add | Edit | Delete | Action Coverage | Status | Notes |
|--------|---------|-----|------|--------|-----------------|--------|-------|
| Settings | Material Classification core | Yes | Yes | Yes | `Undo` | Full | Material create/update/delete, hierarchy node add, chain add, level type update/delete |
| Settings | Material Classification masters panel | Yes | Yes | Yes | `Undo` | Full | Level type and level option create/update/delete/status flows are covered |
| Settings | Material Classification schema builder | Yes | Yes | Yes | `Undo` | Full | Schema create/update/delete are covered; level composition stays local until explicit save |
| Settings | User Access Control | Yes | Yes | Yes | `Undo` | Full | Create, restore, edit, quick edit, bulk status, bulk delete, single delete all covered where rollback is complete |
| Settings | User Access Control hard delete | N/A | N/A | Yes | Success only | Intentional No Undo | Hard delete is intentionally irreversible |
| Settings | User Access Control password reset | N/A | Partial | N/A | Success only | Intentional No Undo | No undo because old password cannot be restored safely |
| Settings | User Access Control force logout / unlock | N/A | Partial | N/A | Success only | Intentional No Undo | Administrative side effects are not reversible in a meaningful way |

---

## Tasks Domain Module

| Module | Feature | Add | Edit | Delete | Action Coverage | Status | Notes |
|--------|---------|-----|------|--------|-----------------|--------|-------|
| Tasks | Team Tasks | Yes | Yes | Yes | `Undo` | Full | Create/edit/delete, quick add, bulk/status/template flows, reschedule, and drag-drop updates are covered |
| Tasks | Task Future | Yes | Yes | Yes | `Undo` | Full | Create/edit/delete, quick add, inline edits, bulk/status/template flows, reschedule, and board/list moves are covered |

---

## Other Modules

| Module | Coverage | Status | Notes |
|--------|----------|--------|-------|
| In-Hand other pages | No action-toast CRUD coverage detected | No Coverage Detected | Document control, procurement, meetings, and daily dashboards remain largely read-heavy in the current audit |
| Operations | No action-toast CRUD coverage detected | No Coverage Detected | No project-level undo/action CRUD usage detected in this scan |
| Dashboard / Auth / Account non-notification pages | No project CRUD action coverage detected | No Coverage Detected | No primary business CRUD action usage surfaced in this audit |

---

## Professional Reading of the Current State

### Covered Well

- Shared toast/undo infrastructure
- Account notifications action flows
- HR leave requests
- In-Hand stores execution forms
- CRM local CRUD surfaces
- Tasks domain module
- Tender pricing, projects, reports, settings, suppliers, and BOQ
- Material classification, including masters and schema builder
- User access control, with correct admin-safe exceptions

### Intentional Exceptions

- `User Access Control hard delete` remains success-only because rollback would be false
- `password reset` remains success-only because the old credential cannot be restored safely
- `force logout / unlock` remain success-only because the administrative side effects are not meaningfully reversible

### Current Reading

- No blocker-grade CRUD gap remains in the routed surfaces that were part of this rollout
- Remaining unaudited areas are operational modules that do not currently expose first-class routed CRUD flows in this rollout scope

---

## Recommended Next Priority

1. Audit `In-Hand` dashboards and `Operations` only when those modules expose primary routed CRUD flows that should follow the same policy.
2. Keep the rule stable:
   - `Undo` when rollback is complete
   - action toast with `onExpire` when destructive work can be deferred
   - plain success/error toast when rollback would be false or incomplete
