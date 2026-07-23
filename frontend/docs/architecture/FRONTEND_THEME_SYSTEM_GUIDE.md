# Frontend Theme System Guide

Date: 2026-03-09

This guide defines the styling source-of-truth for frontend work.

Use it before styling any new page, overlay, panel, table link, or reusable UI block.

## Goal

The project should not rely on scattered hardcoded colors, hover states, outline values, or typography decisions.

Instead, styling should flow through these layers:

1. shared semantic theme tokens
2. shared UI shell tokens
3. page-level aliases
4. component consumers

## 1. Global Source Of Truth

Primary file:
- `src/app/shared/styles/app-theme-system.css`

This file owns the semantic theme system for:
- dark/light palettes
- font family
- text hierarchy
- surfaces and shells
- outline/divider/grid strokes
- link colors and hover behavior
- status colors
- shared sizing tokens used by multiple surfaces

Examples of shared tokens:
- `--app-color-link`
- `--app-color-link-hover`
- `--app-color-text-body`
- `--app-color-text-muted`
- `--app-color-panel-body`
- `--app-color-header`
- `--app-outline-stroke`
- `--app-divider-stroke`
- `--app-row-stroke`
- `--app-link-underline-thickness`
- `--app-link-underline-offset`

Rule:
- If a color, text role, border, or hover behavior can be semantic, define it here first.

## 2. Shared Overlay Shell

Primary file:
- `src/app/shared/ui/overlay-panel.component.impl.ts`

This file owns the shared overlay shell:
- header/body shell
- shell spacing
- icon button structure
- overlay-level token bridge through `--op-*`

Examples:
- `--op-panel-bg`
- `--op-header-bg`
- `--op-panel-border`
- `--op-icon-border`
- `--op-icon-color`
- `--op-body-bg`

Rule:
- Panel shell styling should be configured through overlay tokens.
- Do not rebuild panel chrome locally if the shared overlay can provide it.

## 3. Page Alias Layer

Each page may define page-specific aliases in its root SCSS.

Example:
- `src/app/features/tender/suppliers/presentation/page/tender-suppliers.component.scss`

This layer is allowed to:
- map shared theme tokens into page-specific names
- tune panel variants for that page
- define link aliases for table/grid interactions

Examples from Suppliers page:
- `--sup-link-color`
- `--sup-link-hover-color`
- `--supplier-panel-link-color`
- `--supplier-panel-link-hover-color`
- `--supplier-dossier-link-color`
- `--supplier-dossier-link-hover-color`

Rule:
- If a page needs custom naming or page-scoped tuning, do it here.
- Components should consume aliases, not invent new palette values.

## 4. Component Consumer Layer

Consumer files should mainly define:
- layout
- spacing
- alignment
- density
- content structure

They should consume either:
- shared semantic tokens
- page aliases
- overlay shell tokens

They should not:
- hardcode one-off link colors
- hardcode random outline values
- invent hover behavior already defined centrally

Examples:
- `src/app/features/tender/suppliers/presentation/page/tabs/view-supplier-panel/view-supplier-panel.component.scss`
- `src/app/features/tender/suppliers/presentation/page/tabs/details-supplier-panel/details-supplier-panel.component.scss`
- `src/app/features/tender/suppliers/presentation/page/tabs/official-details-panel/official-details-panel.component.scss`

## 5. Link System

Shared link behavior comes from:
- `src/app/shared/styles/app-theme-system.css`

Shared link classes include:
- `.link`
- `.app-link`
- `.sup-link`
- `.official-link`

The shared system already owns:
- default link color
- hover color
- underline
- underline offset
- transition timing

Rule:
- Reuse the shared link classes first.
- Only add page aliases if a page needs a themed alias for the same shared behavior.

## 6. Outline System

Outlines, dividers, row borders, and empty-state borders should come from semantic stroke tokens.

Examples:
- `--app-outline-stroke`
- `--app-divider-stroke`
- `--app-row-stroke`
- `--app-empty-stroke`

Rule:
- Never hardcode border color and width if a stroke token already exists.
- If a new stroke role is needed, add it to the shared theme system first.

## 7. Typography System

Typography should also be token-driven.

Global source:
- `src/app/shared/styles/app-theme-system.css`

Use semantic text roles, not ad-hoc font colors:
- heading
- subheading
- body
- label
- meta
- empty
- muted

Rule:
- Decide content role first, then use the matching token.
- Do not assign color by visual guesswork.

## 8. Recommended Workflow For A New Page

When styling a new page:

1. Start with `app-theme-system.css`
   - check whether the required color/text/border role already exists

2. If the page needs a page-scoped alias, add it in the page root SCSS
   - map from shared semantic token

3. If the page uses overlays, let the shared overlay shell provide the chrome
   - configure `--op-*` tokens through the page root SCSS

4. Build component SCSS as a consumer
   - layout
   - spacing
   - alignment
   - structure

5. For clickable text, reuse the shared link system
   - `.link` for normal content links
   - page-specific aliases only when needed

## 9. Suppliers Page Reference

The Suppliers page is currently one of the working references for this system:
- shared theme source:
  - `src/app/shared/styles/app-theme-system.css`
- shared overlay shell:
  - `src/app/shared/ui/overlay-panel.component.impl.ts`
- page alias layer:
  - `src/app/features/tender/suppliers/presentation/page/tender-suppliers.component.scss`
- panel consumers:
  - `src/app/features/tender/suppliers/presentation/page/tabs/...`

This page is a valid reference for:
- overlay-driven panels
- page alias mapping
- grid/table clickable links
- link hover behavior tied to theme

## 10. Anti-Patterns

Avoid:
- hardcoded panel hover colors
- panel-local link behavior that conflicts with shared `.link`
- page-specific outline values without semantic token mapping
- duplicated close-button styles across overlays
- typography decisions made per component without semantic role

## 11. Definition Of Done For Theme Work

A styling task is considered aligned when:

1. the value comes from `app-theme-system.css` or a page alias
2. overlay shell styling comes from the shared overlay layer when relevant
3. component files only consume tokens for visuals
4. hover behavior is not duplicated across components
5. dark/light behavior is token-based, not manually patched per state
