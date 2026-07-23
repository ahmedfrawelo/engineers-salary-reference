# Data Grid Selection Hover Lag Playbook

## Scope
This guide documents the hover-lag issue that can affect data-grid pages using:

- sticky selection/index column
- row-number to checkbox hover swap
- dense row/cell hover handling

Confirmed pages during this fix:

- `Tender Projects` page (`/tender/projects`)
- `Tender Suppliers` page (`/tender/suppliers`)

Main visible symptom:

- In the first selection column, row number and checkbox did not switch in exact sync with mouse movement.

Date of final fix:

- March 11, 2026

---

## Problem Symptoms

- Hover felt like it was following the mouse instead of moving with it.
- After scrolling, hover response could feel slower for a short time.
- First-column swap (`row number -> checkbox`) was visibly delayed.
- In RTL sessions, row hover could feel even more detached.

---

## Actual Root Cause

The issue was not one CSS line. It was a stack of small delays:

1. Hover swap depended on Angular-managed row hover state
- The first column was tied to `.is-hovered`, which depends on `mouseenter/mouseleave` and signal updates.
- That adds a render step between mouse movement and visible UI change.

2. Every body cell was also listening to hover events
- `mouseenter`, `mousemove`, and `mouseleave` were wired on dense grid cells.
- Even when tooltips were effectively skipped, the event pipeline still existed.

3. Scroll logic suspended hover responsiveness
- Grid internals used temporary hover suppression / pointer-event suppression during scroll-related activity.
- This created the "lag after scroll" feeling.

4. RTL row hover transform made the lag feel worse
- Hovered rows had a small `translateX(...)` motion in RTL.
- That made the row visually shift under the mouse.

5. Sticky first-column paint overrides were too defensive
- Some late overrides disabled useful compositor/layer optimizations on the sticky selection column and scrollers.
- This increased the repaint cost of the first column.

---

## Final Fix Strategy

Make the interaction browser-native wherever possible for affected dense grids.

### 1) Use direct hover for the first-column swap
- The selection-column number/checkbox swap now responds to direct row `:hover`, not only Angular `.is-hovered`.

### 2) Remove heavy body-cell hover bindings for affected grids
- For `proj-table` and `sup-table`, dense body cells no longer bind unnecessary hover events.
- Click, double-click, and context menu behavior remain intact.

### 3) Remove row-hover bindings for affected grids
- For these pages, rows no longer rely on Angular hover state to drive the visible interaction.
- Browser `:hover` is now the primary path.

### 4) Stop scroll-time hover suppression for affected grids
- Tender page-design grids no longer suspend hover/pointer behavior after scroll.

### 5) Remove remaining hover transitions and RTL hover drift
- Row/cell transitions were disabled for these grids.
- RTL hover translation was disabled for these grids.

### 6) Re-enable light compositor optimization for scrollers and sticky selection column
- Sticky first column now uses lighter paint/compositor settings instead of the previous heavy fallback state.

---

## Files Touched For The Fix

- `src/app/shared/ui/page-design/_page-design-shared.skin.scss`
  - first-column number/checkbox swap now reacts instantly to row hover

- `src/app/shared/data-grid/data-grid.component.html`
  - tender grids now avoid row/body-cell hover bindings where they are not needed

- `src/app/shared/data-grid/data-grid.component.scss`
  - removed row/cell transition delay for tender grids
  - disabled RTL row hover translation for tender grids
  - tuned sticky first-column/compositor behavior

- `src/app/shared/data-grid/data-grid.component.part2.internal.impl.ts`
  - removed tender-grid hover suppression during scroll
  - disabled fast-scroll hover-blocking behavior for tender page-design grids

- `src/app/shared/data-grid/data-grid.component.part4.internal.impl.ts`
  - added tender-grid gating for cell-hover helper behavior

- `src/app/shared/data-grid/data-grid.component.presenter.impl.ts`
  - exposed helper methods used by the template to skip unnecessary tender-grid hover wiring

- `src/app/shared/data-grid/data-grid.page-design-grid.util.ts`
  - centralizes detection of tender page-design project/supplier grids so hover/scroll gates stay aligned

- `src/app/shared/data-grid/data-grid.component.spec.ts`
  - regression coverage for hover-binding gates and scroll-time hover suppression guards

- `e2e/tender-projects-hover.spec.ts`
  - verifies first-column hover swap remains correct before and after grid scrolling on the real Tender Projects page

---

## Why This Fix Is Safe

- It is currently scoped to `proj-table` and `sup-table`.
- It does not remove row selection or checkbox behavior.
- It keeps click, double-click, and context-menu interactions.
- It favors native hover over Angular hover bookkeeping only where that bookkeeping was causing visible lag.

---

## Verify After Any Change

1. Open an affected dense grid page such as `/tender/projects`.
2. Move the mouse vertically across rows.
3. Confirm first-column swap feels immediate.
4. Scroll, then move the mouse immediately again.
5. Confirm there is no short pause after scrolling.
6. If session is RTL, confirm the row does not visually slide under the mouse.

Build verification used for this fix:

- `npx tsc -p tsconfig.app.json --noEmit`
- `npx ng build --configuration development`

---

## If Issue Returns

1. Check whether row hover was re-bound to Angular events in `data-grid.component.html`.
2. Check whether cell hover events were re-enabled for tender grids.
3. Check whether any scroll helper reintroduced hover suspension / pointer-events suppression.
4. Check whether row/cell transitions were reintroduced in `data-grid.component.scss`.
5. Hard refresh (`Ctrl+F5`) and restart the dev server.

---

## Guardrail

For very dense sticky-column grids, do not depend on Angular hover state for purely visual hover feedback when native CSS `:hover` can do the same job.
