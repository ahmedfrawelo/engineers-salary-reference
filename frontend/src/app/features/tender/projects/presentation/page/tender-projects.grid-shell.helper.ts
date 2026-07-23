type ElementRefLike<T extends HTMLElement> = {
  nativeElement: T;
};

type SnapshotOutsideClickHandler = ((event: Event) => void) | null;

type DataGridLike = {
  closeSnapshotManager(): void;
};

export interface TenderProjectsGridShellHost {
  isBrowser: boolean;
  doc: Document;
  grid?: DataGridLike | null;
  dataGridEl?: ElementRefLike<HTMLElement> | null;
  saveViewBtn?: ElementRefLike<HTMLElement> | null;
  lastSnapshotAnchor: HTMLElement | null;
  snapshotMenuObserver: MutationObserver | null;
  snapshotOutsideClickHandler: SnapshotOutsideClickHandler;
  snapshotMenuRaf: number | null;
}

export function closeTenderProjectsSnapshotPanel(host: TenderProjectsGridShellHost): void {
  host.grid?.closeSnapshotManager();
  host.dataGridEl?.nativeElement?.removeAttribute('data-snapshot-open');
}

export function setupTenderProjectsSnapshotMenuObserver(host: TenderProjectsGridShellHost): void {
  if (!host.isBrowser || !host.dataGridEl) return;
  if (typeof MutationObserver === 'undefined' || host.snapshotMenuObserver) return;
  const root = host.dataGridEl.nativeElement;
  host.snapshotMenuObserver = new MutationObserver(() => {
    const panel = root.querySelector('.snapshot-manager-panel');
    if (panel && host.lastSnapshotAnchor) {
      root.setAttribute('data-snapshot-open', 'true');
      queueTenderProjectsSnapshotMenuPosition(host);
    } else {
      root.removeAttribute('data-snapshot-open');
    }
  });
  host.snapshotMenuObserver.observe(root, { childList: true, subtree: true });
}

export function attachTenderProjectsSnapshotOutsideClickHandler(
  host: TenderProjectsGridShellHost
): void {
  if (!host.isBrowser || host.snapshotOutsideClickHandler) {
    return;
  }
  host.snapshotOutsideClickHandler = (event: Event) => {
    const root = host.dataGridEl?.nativeElement;
    if (!root) {
      return;
    }
    const panel = root.querySelector('.snapshot-manager-panel');
    if (!panel) {
      return;
    }
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    const anchor = host.saveViewBtn?.nativeElement ?? host.lastSnapshotAnchor;
    if ((panel as HTMLElement).contains(target) || (anchor && anchor.contains(target))) {
      return;
    }
    closeTenderProjectsSnapshotPanel(host);
  };
  host.doc.addEventListener('click', host.snapshotOutsideClickHandler, true);
}

export function queueTenderProjectsSnapshotMenuPosition(host: TenderProjectsGridShellHost): void {
  if (!host.isBrowser || !host.dataGridEl || !host.lastSnapshotAnchor) return;
  if (host.snapshotMenuRaf != null) cancelAnimationFrame(host.snapshotMenuRaf);
  host.snapshotMenuRaf = requestAnimationFrame(() => {
    host.snapshotMenuRaf = null;
    syncTenderProjectsSnapshotMenuPosition(host);
  });
}

export function syncTenderProjectsSnapshotMenuPosition(host: TenderProjectsGridShellHost): void {
  if (!host.isBrowser || !host.dataGridEl || !host.lastSnapshotAnchor) {
    return;
  }
  const root = host.dataGridEl.nativeElement;
  const anchor = host.lastSnapshotAnchor;
  const rootRect = root.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const top = Math.max(anchorRect.bottom - rootRect.top + 6, 8);
  const right = Math.max(rootRect.right - anchorRect.right + 6, 8);
  root.style.setProperty('--proj-snapshot-top', `${top}px`);
  root.style.setProperty('--proj-snapshot-right', `${right}px`);
  root.style.setProperty('--proj-snapshot-left', 'auto');
}
