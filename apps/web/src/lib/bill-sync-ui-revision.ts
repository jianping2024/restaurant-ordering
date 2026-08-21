/**
 * Client-safe bill revision hint for enabling Sync after content changes.
 * Server gate remains billSyncContentFingerprint in bill-sync-enqueue.
 */
export function billSyncUiContentRevision(input: {
  totalAmount: number;
  discountRate: number;
  orders: ReadonlyArray<{ id: string; updated_at?: string | null; items?: unknown }>;
}): string {
  const orderPart = input.orders
    .map((o) => `${o.id}:${o.updated_at ?? ''}:${JSON.stringify(o.items ?? null)}`)
    .join('|');
  return `${input.totalAmount.toFixed(2)}:${input.discountRate}:${orderPart}`;
}
