type SignalCell<T> = {
  (): T;
  set(value: T): void;
};

type BulkDeleteModalHost = {
  saving: SignalCell<boolean>;
  selectedKeys: SignalCell<Set<string>>;
  bulkDeleteKeys: SignalCell<string[] | null>;
};

export function openUserAccessBulkDeleteModal(host: BulkDeleteModalHost): void {
  const keys = Array.from(host.selectedKeys());
  if (!keys.length) {
    return;
  }
  host.bulkDeleteKeys.set(keys);
}

export function closeUserAccessBulkDeleteModal(host: BulkDeleteModalHost): void {
  if (host.saving()) {
    return;
  }
  host.bulkDeleteKeys.set(null);
}

export function userAccessBulkDeleteCount(host: BulkDeleteModalHost): number {
  return host.bulkDeleteKeys()?.length ?? 0;
}
