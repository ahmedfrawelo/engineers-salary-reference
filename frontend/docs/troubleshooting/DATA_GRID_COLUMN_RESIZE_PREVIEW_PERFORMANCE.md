# DataGrid Column Resize Preview Performance

## Symptom

While dragging a column resize handle, the grid could feel heavier than it should:

- resize preview was less responsive on dense tables
- the first drag after load felt more expensive than later drags
- header/body/footer width sync did extra work on every preview frame

## Root Cause

The resize flow was repeating work that does not need to happen on every `mousemove`:

- minimum and maximum width were recalculated during live drag
- preview sync re-queried the same header/body/footer table DOM repeatedly
- preview frames also triggered default-grid overflow synchronization even before commit

That added unnecessary layout and DOM work during the hottest path of the interaction.

## Correct Fix

The implemented fix keeps the behavior the same, but makes preview frames cheaper:

1. Cache resize bounds once at drag start:
   - `resizeMinWidth`
   - `resizeMaxWidth`
   - file: `src/app/shared/data-grid/core/runtime/data-grid.component.part2.internal.impl.ts`

2. Reuse the cached bounds in both:
   - live `mousemove` width calculation
   - preview `applyColumnWidth(...)`

3. Cache synchronized width targets during the active resize session:
   - root
   - viewport
   - header/body/footer tables
   - colgroup column references

4. Skip `queueDefaultGridOverflowSync()` during preview-only frames.
   Overflow sync still runs on the committed resize result.

5. Clear all resize caches when the drag ends so the next session starts clean.

## Do Not Reintroduce

Do not bring back any of the following in the live resize path:

- recalculating `getMinimumColumnWidth(...)` on every mouse move
- recalculating `getMaximumColumnWidth(...)` on every mouse move
- querying `.header-table`, `.data-grid-table`, and footer colgroups on every preview frame
- triggering overflow reconciliation on preview-only updates

Those paths directly increase resize latency.

## Files Involved

- `src/app/shared/data-grid/core/state/data-grid.component.state.ts`
- `src/app/shared/data-grid/core/presenter/data-grid.component.presenter.columns.base.ts`
- `src/app/shared/data-grid/core/runtime/data-grid.component.part2.internal.impl.ts`
- `src/app/shared/data-grid/core/runtime/data-grid.component.part2.internal.impl.spec.ts`

## Verification

The fix was verified with:

- `npx vitest run src/app/shared/data-grid/core/runtime/data-grid.component.part2.internal.impl.spec.ts`
- `npm run build`
- `git diff --check`

Angular `ng test` remains blocked by an unrelated existing issue in:

- `src/app/shared/toast/toast.component.spec.ts`
