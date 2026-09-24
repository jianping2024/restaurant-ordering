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

/** Fiscal payment methods accepted on Farvoo→Agent auto_issue + checkout collect. */
export type BillSyncPaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'MBWAY'
  | 'MULTIBANCO'
  | 'MIXED'
  | 'OTHER';

/** Sole ordered list for collect + invoice payment pickers. */
export const BILL_SYNC_PAYMENT_METHODS: readonly BillSyncPaymentMethod[] = [
  'CASH',
  'CARD',
  'MBWAY',
  'MULTIBANCO',
  'MIXED',
  'OTHER',
] as const;

/** Sole parse/normalize for collect + invoice + ledger. */
export function parseBillSyncPaymentMethod(
  raw: string | null | undefined,
): BillSyncPaymentMethod | null {
  const m = (raw ?? '').trim().toUpperCase();
  return (BILL_SYNC_PAYMENT_METHODS as readonly string[]).includes(m)
    ? (m as BillSyncPaymentMethod)
    : null;
}

/** Sole thermal-receipt tender label from ledger method (never hardcode Cash elsewhere). */
export function receiptPaymentMethodLabel(
  method: string | null | undefined,
): string {
  switch (parseBillSyncPaymentMethod(method) ?? 'CASH') {
    case 'CASH':
      return 'Cash';
    case 'CARD':
      return 'Card';
    case 'MBWAY':
      return 'MB Way';
    case 'MULTIBANCO':
      return 'Multibanco';
    case 'MIXED':
      return 'Mixed';
    case 'OTHER':
      return 'Other';
  }
}

export type BillSyncDocumentType = 'FT' | 'FS';

export type BillSyncPayload = {
  request_id: string;
  source_system: 'farvoo';
  source_sale_id: string;
  table_display_name: string;
  scope_type: BillSyncScopeType;
  lines?: BillSyncLine[];
  gross_total?: string;
  splits?: BillSyncSplit[];
  /** Agent auto_issue (print invoice). Omitted for draft-only sync. */
  auto_issue?: boolean;
  customer_nif?: string;
  customer_name?: string;
  payment_method?: BillSyncPaymentMethod | string;
  document_type?: BillSyncDocumentType;
  issue_mode?: 'whole_table' | 'person';
  issue_scope_id?: string;
  scope_id?: string;
  /**
   * When set, Agent skips ingest/auto_issue and only calls existing ReprintDocument.
   * Sole Farvoo→Agent reprint hang-queue shape (same bill_sync_jobs pipe).
   */
  reprint_document_id?: string;
};

/** Sole document_type from payment (CASH→FS, else FT). */
export function billSyncDocumentTypeForPayment(
  paymentMethod: string | null | undefined,
): BillSyncDocumentType {
  const m = (paymentMethod ?? '').trim().toUpperCase();
  return m === 'CASH' || m === '' ? 'FS' : 'FT';
}

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

const SCOPE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidBillSyncScopeId(value: string | undefined | null): boolean {
  return typeof value === 'string' && SCOPE_ID_RE.test(value.trim());
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
  } else if (payload.scope_type === 'split') {
    if (!payload.splits?.length) return 'missing_splits';
    if (payload.lines?.length) return 'scope_payload_mismatch';
    if (payload.gross_total != null && String(payload.gross_total).trim() !== '') {
      return 'scope_payload_mismatch';
    }
    for (const split of payload.splits) {
      if (!isValidBillSyncScopeId(split.scope_id)) return 'invalid_scope_id';
      if (!split.name?.trim()) return 'empty_person_name';
      if (!split.lines?.length) return 'empty_lines';
      if (!split.gross_total || !isValidBillSyncMoneyString(split.gross_total)) {
        return 'invalid_gross_total';
      }
    }
  } else {
    return 'invalid_scope_type';
  }
  return null;
}
