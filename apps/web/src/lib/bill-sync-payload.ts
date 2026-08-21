/**
 * Sole Farvoo→fiscal bill-sync snapshot builders / validators (bill-sync-contract-v1.0).
 * Do not add a parallel payload shape beside this module.
 */

export type BillSyncScopeType = 'whole_table' | 'split';

export type BillSyncLine = {
  item_code: string;
  name: string;
  qty: string;
  unit_price_gross: string;
  line_gross: string;
  vat_rate: string;
};

export type BillSyncSplit = {
  scope_id: string;
  name: string;
  lines: BillSyncLine[];
  gross_total: string;
};

export type BillSyncPayload = {
  request_id: string;
  source_system: 'farvoo';
  source_sale_id: string;
  table_display_name: string;
  scope_type: BillSyncScopeType;
  lines?: BillSyncLine[];
  gross_total?: string;
  splits?: BillSyncSplit[];
};

const VAT_RATE_RE = /^\d+\.\d{2}$/;
const MONEY_RE = /^\d+\.\d{2}$/;

/** Percent points with two decimals, e.g. 13 → "13.00". Never "0.13". */
export function formatBillSyncVatRate(percentPoints: number): string {
  if (!Number.isFinite(percentPoints)) {
    throw new Error('invalid_vat_rate');
  }
  return percentPoints.toFixed(2);
}

export function formatBillSyncMoney(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error('invalid_money');
  }
  return (Math.round(amount * 100) / 100).toFixed(2);
}

export function isValidBillSyncVatRateString(value: string): boolean {
  if (!VAT_RATE_RE.test(value)) return false;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return false;
  // Reject fraction-style rates that slipped through as "0.23"
  if (n > 0 && n < 1) return false;
  return true;
}

export function isValidBillSyncMoneyString(value: string): boolean {
  return MONEY_RE.test(value);
}

export type BillSyncLineInput = {
  item_code: string;
  name: string;
  qty: number;
  unit_price_gross: number;
  line_gross: number;
  vat_rate_percent: number;
};

export function buildBillSyncLine(input: BillSyncLineInput): BillSyncLine | { error: string } {
  const item_code = input.item_code.trim();
  if (!item_code) return { error: 'empty_item_code' };
  const name = input.name.trim();
  if (!name) return { error: 'empty_name' };
  if (!(input.qty > 0) || !Number.isFinite(input.qty)) return { error: 'invalid_qty' };

  let vat_rate: string;
  let unit_price_gross: string;
  let line_gross: string;
  let qty: string;
  try {
    vat_rate = formatBillSyncVatRate(input.vat_rate_percent);
    unit_price_gross = formatBillSyncMoney(input.unit_price_gross);
    line_gross = formatBillSyncMoney(input.line_gross);
    qty = formatBillSyncMoney(input.qty);
  } catch {
    return { error: 'invalid_number' };
  }
  if (!isValidBillSyncVatRateString(vat_rate)) return { error: 'invalid_vat_rate' };

  return { item_code, name, qty, unit_price_gross, line_gross, vat_rate };
}

/** Detect conflicting catalog fields for the same item_code within one payload. */
export function findBillSyncItemCodeConflict(
  lines: BillSyncLine[],
): { item_code: string } | null {
  const seen = new Map<string, BillSyncLine>();
  for (const line of lines) {
    const prev = seen.get(line.item_code);
    if (!prev) {
      seen.set(line.item_code, line);
      continue;
    }
    if (
      prev.name !== line.name ||
      prev.unit_price_gross !== line.unit_price_gross ||
      prev.vat_rate !== line.vat_rate
    ) {
      return { item_code: line.item_code };
    }
  }
  return null;
}

export function collectBillSyncLines(payload: BillSyncPayload): BillSyncLine[] {
  if (payload.scope_type === 'whole_table') return payload.lines ?? [];
  return (payload.splits ?? []).flatMap((s) => s.lines);
}

export function validateBillSyncPayload(payload: BillSyncPayload): string | null {
  if (payload.source_system !== 'farvoo') return 'invalid_source_system';
  if (!payload.request_id?.trim()) return 'missing_request_id';
  if (!payload.source_sale_id?.trim()) return 'missing_source_sale_id';
  if (!payload.table_display_name?.trim()) return 'missing_table_display_name';

  const lines = collectBillSyncLines(payload);
  if (lines.length === 0) return 'empty_lines';
  for (const line of lines) {
    if (!line.item_code.trim()) return 'empty_item_code';
    if (!isValidBillSyncVatRateString(line.vat_rate)) return 'invalid_vat_rate';
    if (!isValidBillSyncMoneyString(line.unit_price_gross)) return 'invalid_money';
    if (!isValidBillSyncMoneyString(line.line_gross)) return 'invalid_money';
    if (!isValidBillSyncMoneyString(line.qty) && !/^\d+(\.\d{1,2})?$/.test(line.qty)) {
      return 'invalid_qty';
    }
  }
  if (findBillSyncItemCodeConflict(lines)) return 'item_code_conflict';

  if (payload.scope_type === 'whole_table') {
    if (!payload.gross_total || !isValidBillSyncMoneyString(payload.gross_total)) {
      return 'invalid_gross_total';
    }
    if (payload.splits?.length) return 'scope_payload_mismatch';
  } else {
    if (!payload.splits?.length) return 'missing_splits';
    if (payload.lines?.length) return 'scope_payload_mismatch';
  }
  return null;
}
