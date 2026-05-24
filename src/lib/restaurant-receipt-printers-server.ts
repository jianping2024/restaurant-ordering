import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isValidReceiptPrinterId,
  parseReceiptPrinterRoutingSnapshot,
  type ReceiptPrinterRoutingSnapshot,
} from '@/lib/print-receipt-printer-options';

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
    .limit(5);

  if (error) return null;
  for (const row of devices || []) {
    const parsed = parseReceiptPrinterRoutingSnapshot(row.routing_snapshot);
    if (parsed) return parsed;
  }
  return null;
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
