import type { OrderHistoryEntry } from '@/lib/order-history/types';

export function findOrderHistoryEntryBySessionId(
  entries: OrderHistoryEntry[],
  sessionId: string,
): OrderHistoryEntry | undefined {
  return entries.find((row) => row.sessionId === sessionId);
}
