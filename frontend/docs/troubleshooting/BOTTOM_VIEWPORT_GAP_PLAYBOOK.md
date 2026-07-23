# Tasks Viewport Bottom Gap Playbook

## Scope
This guide documents the bottom-gap issue in Tasks workspace pages:
- `/tender/tasks`
- `/in-hand/tasks`
- `/operations/tasks`

Affected views:
- List
- Board
- Calendar
- Gantt
- Table

Date of final root-cause fix:
- February 14, 2026

---

## Problem Symptoms
- Empty dark gap appears at the bottom of the tasks page.
- In Board view, horizontal scrollbar appears above page bottom instead of the end of visible viewport.
- Same visual gap appears in non-board views too.

---

## Root Cause (Actual)
The issue was page-level layout, not board-only layout.

`tasks-page.clickup-page` is a flex container, and it had a `gap`.
Inside this same container there are multiple `overlay-panel` elements (task panel, columns panel, templates, automations, etc.).

Even when overlays are closed, their host elements still exist as flex items.
Because of flex `gap`, they reserve visual spacing between siblings, producing a persistent bottom blank area.

This is why the gap appeared across all views, not only Board.

---

## Final Fix
Set tasks page container gap to zero at global route-aware level:

- `src/styles.css`
  - added hard override for tasks pages:
    - `body.tender-tasks-page .tasks-page.clickup-page { gap: 0 !important; }`
    - with fallbacks for `main.content:has(task-future)` and `main.content:has(tender-tasks)`

Also kept board-specific viewport lock hardening:
- scale-aware height calculation for zoom/app-scale environments
- resize + visualViewport listeners

Files:
- `src/styles.css`
- `src/app/features/tasks/presentation/task-future/task-future.component.impl.ts`
- `src/app/features/tasks/presentation/page/team-tasks.component.impl.ts`

---

## Why This Fix Is Safe
- It only removes container-level flex gap in tasks pages.
- It does not remove spacing inside toolbars/boards/lists.
- Internal spacing remains controlled by child padding/margins.

---

## Verify After Any Change
1. Open `/tender/tasks`.
2. Switch between List and Board.
3. Confirm no bottom blank strip under content.
4. In Board view, confirm horizontal scrollbar is at the page bottom area (no fake gap below it).
5. In DevTools, check:
   - `.tasks-page.clickup-page` computed `gap` must be `0px`.

---

## If Issue Returns
1. Check if any new CSS reintroduced `gap` on `.tasks-page` or `.clickup-page`.
2. Check if route class `body.tender-tasks-page` is present.
3. Hard refresh (`Ctrl+F5`) and restart dev server.
4. Re-check global override in `src/styles.css` near the tasks troubleshooting block.

---

## Guardrail
Do not use parent `flex gap` on the top tasks page shell when it contains overlay hosts.
If spacing is needed, apply spacing on the content child (`.tasks-scroll`) instead.
