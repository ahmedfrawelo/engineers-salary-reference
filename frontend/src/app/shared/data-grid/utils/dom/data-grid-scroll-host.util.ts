const DATA_GRID_MAIN_SCROLL_HOST_ATTR = 'data-grid-scroll-host';
const DATA_GRID_MAIN_SCROLL_HOST_VALUE = 'main';

function canQueryDom(root: ParentNode | null | undefined): root is ParentNode {
  return !!root && typeof root.querySelector === 'function';
}

function isMainScrollHostElement(node: ParentNode | null | undefined): node is HTMLElement {
  return (
    node instanceof HTMLElement &&
    node.getAttribute(DATA_GRID_MAIN_SCROLL_HOST_ATTR) === DATA_GRID_MAIN_SCROLL_HOST_VALUE
  );
}

export function resolveDataGridMainScrollHost(
  root: ParentNode | null | undefined
): HTMLElement | null {
  if (isMainScrollHostElement(root)) {
    return root;
  }

  if (!canQueryDom(root)) {
    return null;
  }

  return root.querySelector<HTMLElement>(
    `[${DATA_GRID_MAIN_SCROLL_HOST_ATTR}="${DATA_GRID_MAIN_SCROLL_HOST_VALUE}"]`
  );
}
