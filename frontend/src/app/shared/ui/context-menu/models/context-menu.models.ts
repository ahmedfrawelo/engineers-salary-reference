export type SharedContextMenuItem = {
  id: string;
  label: string;
  /** Optional non-interactive group label rendered immediately before this item. */
  sectionLabel?: string;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Renders a full-width divider instead of a clickable row. */
  separator?: boolean;
  /** Small pill next to the label (e.g. Current). */
  badge?: string;
  hint?: string;
  children?: SharedContextMenuItem[];
  /** When set on a parent with children, shows a search field in the submenu. */
  searchable?: boolean;
  searchPlaceholder?: string;
};

export type SharedContextMenuPlacement = 'pointer' | 'anchor';

export type SharedContextMenuSubmenuSide = 'left' | 'right';
