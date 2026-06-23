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

export type StationRow = {
  id: string;
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  sort_order?: number;
};

export function stationDisplayName(station: StationRow, locale: 'pt' | 'en' | 'zh' = 'pt'): string {
  if (locale === 'zh' && station.name_zh?.trim()) return station.name_zh.trim();
  if (locale === 'en' && station.name_en?.trim()) return station.name_en.trim();
  return station.name_pt?.trim() || station.id;
}

/** Receipt picker: one entry per mapped print station (checkout picks explicitly). */
export function buildReceiptPrinterSnapshot(params: {
  stationPrinters: Record<string, string>;
  stations: StationRow[];
}): ReceiptPrinterRoutingSnapshot {
  const options: ReceiptPrinterOption[] = [];
  const mapped = params.stationPrinters;
  const listed = new Set<string>();

  const sortedStations = [...params.stations].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id),
  );

  for (const station of sortedStations) {
    const addr = mapped[station.id]?.trim();
    if (!addr) continue;
    listed.add(station.id);
    options.push({
      id: `station:${station.id}`,
      label: stationDisplayName(station),
      role: 'station',
    });
  }

  for (const [stationId, addr] of Object.entries(mapped)) {
    if (!stationId.trim() || !addr.trim() || listed.has(stationId)) continue;
    options.push({
      id: `station:${stationId}`,
      label: stationId.slice(0, 8),
      role: 'station',
    });
  }

  return {
    receipt_printers: options,
    updated_at: new Date().toISOString(),
  };
}

/** Refresh station labels from Mesa print_stations (locale) and keep checkout sort order. */
export function presentReceiptPrintersForCheckout(
  printers: ReceiptPrinterOption[],
  stations: StationRow[],
  locale: 'pt' | 'en' | 'zh',
): ReceiptPrinterOption[] {
  const order = new Map(
    [...stations]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id))
      .map((s, idx) => [s.id, idx]),
  );
  const byId = new Map(stations.map((s) => [s.id, s]));

  const enriched = printers
    .filter((p) => p.id.startsWith('station:'))
    .map((p) => {
      const sid = p.id.slice('station:'.length);
      const station = byId.get(sid);
      if (!station) return p;
      return { ...p, label: stationDisplayName(station, locale) };
    });

  enriched.sort((a, b) => {
    const ia = order.get(a.id.slice('station:'.length)) ?? 999;
    const ib = order.get(b.id.slice('station:'.length)) ?? 999;
    return ia - ib;
  });
  return enriched;
}

export function parseReceiptPrinterRoutingSnapshot(raw: unknown): ReceiptPrinterRoutingSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { receipt_printers?: unknown; updated_at?: unknown };
  if (!Array.isArray(o.receipt_printers)) return null;
  const receipt_printers: ReceiptPrinterOption[] = [];
  for (const row of o.receipt_printers) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { id?: unknown; label?: unknown };
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
