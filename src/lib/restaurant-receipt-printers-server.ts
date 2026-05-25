import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isValidReceiptPrinterId,
  parseReceiptPrinterRoutingSnapshot,
  type ReceiptPrinterOption,
  type ReceiptPrinterRoutingSnapshot,
} from '@/lib/print-receipt-printer-options';

/** Union routing from all active agents (newer devices listed first for same id). */
export async function loadRestaurantReceiptPrinterSnapshot(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<ReceiptPrinterRoutingSnapshot | null> {
  const { data: devices, error } = await admin
    .from('print_agent_devices')
    .select('routing_snapshot, paired_at')
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .order('paired_at', { ascending: false })
    .limit(10);

  if (error) return null;

  const merged = new Map<string, ReceiptPrinterOption>();
  let latestUpdated = '';

  for (const row of devices || []) {
    const parsed = parseReceiptPrinterRoutingSnapshot(row.routing_snapshot);
    if (!parsed) continue;
    if (parsed.updated_at && parsed.updated_at > latestUpdated) {
      latestUpdated = parsed.updated_at;
    }
    for (const p of parsed.receipt_printers) {
      if (!merged.has(p.id)) {
        merged.set(p.id, p);
      }
    }
  }

  if (merged.size === 0) return null;

  return {
    receipt_printers: Array.from(merged.values()),
    updated_at: latestUpdated || new Date().toISOString(),
  };
}

export function assertReceiptPrinterIdAllowed(
  printerId: string | undefined,
  snapshot: ReceiptPrinterRoutingSnapshot | null,
): string | null {
  const id = printerId?.trim();
  if (!id) return null;
  if (!isValidReceiptPrinterId(id, snapshot)) {
    return null;
  }
  return id;
}
