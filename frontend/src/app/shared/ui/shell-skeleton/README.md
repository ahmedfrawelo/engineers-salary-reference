# Shell Skeleton

Reusable shell-level skeleton loader used by wrappers like `app-grid-shell`.

## Component

- Selector: `app-shell-skeleton`
- Standalone: `true`

## Inputs

- `variant`: `'table' | 'list'` (default: `'table'`)
- `rows`: `number` (default: `8`)
- `columns`: `number` (default: `9`)
- `header`: `boolean` (default: `true`)

## Example

```html
<app-shell-skeleton
  [variant]="'table'"
  [rows]="10"
  [columns]="8"
  [header]="true"
></app-shell-skeleton>
```
