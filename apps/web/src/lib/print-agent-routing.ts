import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReceiptPrinterSnapshot,
  parseReceiptPrinterRoutingSnapshot,
  type ReceiptPrinterRoutingSnapshot,
  type StationRow,
} from '@/lib/print-receipt-printer-options';

/** Minimal print job row for agent delivery filtering. */
export type PrintJobDeliveryRow = {
  id: string;
  type: string;
  payload: unknown;
};

export type StationMappingConflict = {
  station_id: string;
  station_label: string;
  other_device_id: string;
  other_device_label: string | null;
};

export type SaveDeviceRoutingResult =
  | { ok: true; snapshot: ReceiptPrinterRoutingSnapshot }
  | { ok: false; code: 'invalid_station' | 'station_mapping_conflict' | 'update_failed'; conflicts?: StationMappingConflict[]; message?: string };

const RECEIPT_STATION_PREFIX = 'station:';

export function parseReceiptStationId(receiptPrinterId: string | null | undefined): string | null {
  const id = typeof receiptPrinterId === 'string' ? receiptPrinterId.trim() : '';
  if (!id.startsWith(RECEIPT_STATION_PREFIX)) return null;
  const stationId = id.slice(RECEIPT_STATION_PREFIX.length).trim();
  return stationId || null;
}

/** Station UUIDs this device is subscribed to (from synced routing_snapshot). */
export function stationIdsFromRoutingSnapshot(raw: unknown): Set<string> {
  const parsed = parseReceiptPrinterRoutingSnapshot(raw);
  if (!parsed) return new Set();
  const ids = parsed.receipt_printers
    .map((p) => parseReceiptStationId(p.id))
    .filter((id): id is string => !!id);
  return new Set(ids);
}

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

/** Target print_station for delivery routing (station_ticket or receipt station:…). */
export function printJobTargetStationId(job: Pick<PrintJobDeliveryRow, 'type' | 'payload'>): string | null {
  const p = payloadRecord(job.payload);
  if (!p) return null;

  if (job.type === 'station_ticket') {
    const sid = typeof p.print_station_id === 'string' ? p.print_station_id.trim() : '';
    return sid || null;
  }

  if (job.type === 'order_receipt' || job.type === 'pre_bill') {
    const rid = typeof p.receipt_printer_id === 'string' ? p.receipt_printer_id : '';
    return parseReceiptStationId(rid);
  }

  return null;
}

/**
 * Whether this device should receive the job in pending-jobs / claim paths.
 * Empty deviceStationIds → no jobs (device not configured for any station).
 */
export function isPrintJobVisibleToDevice(
  job: Pick<PrintJobDeliveryRow, 'type' | 'payload'>,
  deviceStationIds: ReadonlySet<string>,
): boolean {
  if (deviceStationIds.size === 0) return false;

  const target = printJobTargetStationId(job);
  if (target) return deviceStationIds.has(target);

  if (job.type === 'order_receipt' || job.type === 'pre_bill') {
    return true;
  }

  return false;
}

export function filterPrintJobsForDevice<T extends PrintJobDeliveryRow>(
  jobs: T[],
  deviceStationIds: ReadonlySet<string>,
): T[] {
  return jobs.filter((job) => isPrintJobVisibleToDevice(job, deviceStationIds));
}

export function normalizeStationPrintersInput(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const sid = k.trim();
    const addr = typeof v === 'string' ? v.trim() : '';
    if (sid && addr) out[sid] = addr;
  }
  return out;
}

function stationLabelById(stations: StationRow[], stationId: string): string {
  const row = stations.find((s) => s.id === stationId);
  if (!row) return stationId.slice(0, 8);
  return row.name_zh?.trim() || row.name_en?.trim() || row.name_pt?.trim() || stationId.slice(0, 8);
}

export async function loadDeviceRoutingStationIds(
  admin: SupabaseClient,
  deviceId: string,
  restaurantId: string,
): Promise<Set<string>> {
  const { data, error } = await admin
    .from('print_agent_devices')
    .select('routing_snapshot')
    .eq('id', deviceId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error || !data) return new Set();
  return stationIdsFromRoutingSnapshot(data.routing_snapshot);
}

type DeviceRoutingRow = {
  id: string;
  label: string | null;
  routing_snapshot: unknown;
};

export async function findStationMappingConflicts(
  admin: SupabaseClient,
  restaurantId: string,
  deviceId: string,
  incomingStationIds: string[],
  stations: StationRow[],
): Promise<StationMappingConflict[]> {
  const incoming = new Set(incomingStationIds.filter(Boolean));
  if (incoming.size === 0) return [];

  const { data: devices, error } = await admin
    .from('print_agent_devices')
    .select('id, label, routing_snapshot')
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .neq('id', deviceId);

  if (error || !devices?.length) return [];

  const conflicts: StationMappingConflict[] = [];
  for (const row of devices as DeviceRoutingRow[]) {
    const occupied = stationIdsFromRoutingSnapshot(row.routing_snapshot);
    for (const stationId of incomingStationIds) {
      if (!incoming.has(stationId)) continue;
      if (!occupied.has(stationId)) continue;
      conflicts.push({
        station_id: stationId,
        station_label: stationLabelById(stations, stationId),
        other_device_id: row.id,
        other_device_label: row.label,
      });
    }
  }

  conflicts.sort(
    (a, b) =>
      a.station_label.localeCompare(b.station_label) || a.other_device_id.localeCompare(b.other_device_id),
  );
  return conflicts;
}

export async function saveDeviceRoutingSnapshot(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    deviceId: string;
    stationPrinters: Record<string, string>;
    stations: StationRow[];
  },
): Promise<SaveDeviceRoutingResult> {
  const validStationIds = new Set(params.stations.map((s) => s.id));
  const incomingIds = Object.keys(params.stationPrinters);
  for (const sid of incomingIds) {
    if (!validStationIds.has(sid)) {
      return { ok: false, code: 'invalid_station', message: `Unknown print station ${sid}` };
    }
  }

  const conflicts = await findStationMappingConflicts(
    admin,
    params.restaurantId,
    params.deviceId,
    incomingIds,
    params.stations,
  );
  if (conflicts.length > 0) {
    return { ok: false, code: 'station_mapping_conflict', conflicts };
  }

  const snapshot = buildReceiptPrinterSnapshot({
    stationPrinters: params.stationPrinters,
    stations: params.stations,
  });

  const { error } = await admin
    .from('print_agent_devices')
    .update({
      routing_snapshot: snapshot,
      mapped_station_count: snapshot.receipt_printers.length,
    })
    .eq('id', params.deviceId)
    .eq('restaurant_id', params.restaurantId);

  if (error) {
    return { ok: false, code: 'update_failed', message: error.message };
  }

  return { ok: true, snapshot };
}

export function stationLabelsFromRoutingSnapshot(raw: unknown): string[] {
  const parsed = parseReceiptPrinterRoutingSnapshot(raw);
  if (!parsed) return [];
  return parsed.receipt_printers.map((p) => p.label).filter((label) => !!label.trim());
}
