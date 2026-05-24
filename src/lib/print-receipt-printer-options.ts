export type ReceiptPrinterRole = 'station';

export type ReceiptPrinterOption = {
  id: string;
  label: string;
  role: ReceiptPrinterRole;
};

export type ReceiptPrinterRoutingSnapshot = {
  receipt_printers: ReceiptPrinterOption[];
  updated_at: string;
};

type StationRow = {
  id: string;
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
};

export function stationDisplayName(station: StationRow, locale: 'pt' | 'en' | 'zh' = 'pt'): string {
  if (locale === 'zh' && station.name_zh?.trim()) return station.name_zh.trim();
  if (locale === 'en' && station.name_en?.trim()) return station.name_en.trim();
  return station.name_pt?.trim() || station.id;
}

/** Receipt picker options: only print stations with a mapped printer (no default cashier). */
export function buildReceiptPrinterSnapshot(params: {
  stationPrinters: Record<string, string>;
  stations: StationRow[];
}): ReceiptPrinterRoutingSnapshot {
  const options: ReceiptPrinterOption[] = [];
  const stationById = new Map(params.stations.map((s) => [s.id, s]));
  for (const [stationId, addr] of Object.entries(params.stationPrinters)) {
    if (!stationId.trim() || !addr.trim()) continue;
    const station = stationById.get(stationId);
    const name = station ? stationDisplayName(station) : stationId.slice(0, 8);
    options.push({
      id: `station:${stationId}`,
      label: name,
      role: 'station',
    });
  }
  return {
    receipt_printers: options,
    updated_at: new Date().toISOString(),
  };
}

export function parseReceiptPrinterRoutingSnapshot(raw: unknown): ReceiptPrinterRoutingSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { receipt_printers?: unknown; updated_at?: unknown };
  if (!Array.isArray(o.receipt_printers)) return null;
  const receipt_printers: ReceiptPrinterOption[] = [];
  for (const row of o.receipt_printers) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { id?: unknown; label?: unknown; role?: unknown };
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const label = typeof r.label === 'string' ? r.label.trim() : '';
    if (!id.startsWith('station:') || !label) continue;
    receipt_printers.push({ id, label, role: 'station' });
  }
  return {
    receipt_printers,
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : new Date().toISOString(),
  };
}

export function isValidReceiptPrinterId(
  id: string,
  snapshot: ReceiptPrinterRoutingSnapshot | null,
): boolean {
  const trimmed = id.trim();
  if (!trimmed) return false;
  if (!snapshot) return false;
  return snapshot.receipt_printers.some((p) => p.id === trimmed);
}
