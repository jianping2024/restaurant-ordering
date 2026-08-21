import { createHash } from 'crypto';
import type { BillSyncLine, BillSyncPayload, BillSyncSplit } from './bill-sync-payload';

function normalizeLine(line: BillSyncLine) {
  return {
    item_code: line.item_code,
    name: line.name,
    qty: line.qty,
    unit_price_gross: line.unit_price_gross,
    line_gross: line.line_gross,
    vat_rate: line.vat_rate,
  };
}

function normalizeSplit(split: BillSyncSplit) {
  return {
    scope_id: split.scope_id,
    name: split.name,
    lines: (split.lines ?? []).map(normalizeLine),
    gross_total: split.gross_total,
  };
}

/**
 * Content fingerprint for unchanged-sync gate (excludes request_id).
 * Canonical field order so jsonb round-trip matches freshly built payloads.
 */
export function billSyncContentFingerprint(payload: BillSyncPayload): string {
  const content = {
    source_system: payload.source_system,
    source_sale_id: payload.source_sale_id,
    table_display_name: payload.table_display_name,
    scope_type: payload.scope_type,
    lines: payload.lines?.map(normalizeLine) ?? null,
    gross_total: payload.gross_total ?? null,
    splits: payload.splits?.map(normalizeSplit) ?? null,
  };
  return createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16);
}
