/**
 * Sole Farvoo→fiscal bill-sync snapshot builders / validators (bill-sync-contract-v1.0).
 * Do not add a parallel payload shape beside this module.
 *
 * Collect / invoice / ledger payment: sole codes CASH | MULTIBANCO | MIXED
 * (see docs/product/collect-payment-receipt-iva.zh.md).
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

/** Sole tender codes for checkout collect + auto_issue (no CARD/MBWAY/OTHER). */
export type BillSyncPaymentMethod = 'CASH' | 'MULTIBANCO' | 'MIXED';

/** Sole ordered list for collect + invoice payment pickers. */
export const BILL_SYNC_PAYMENT_METHODS: readonly BillSyncPaymentMethod[] = [
  'CASH',
  'MULTIBANCO',
  'MIXED',
] as const;

/** Line methods inside payment_lines (never MIXED as a line method). */
export type BillSyncPaymentLineMethod = 'CASH' | 'MULTIBANCO';

/** Sole payment_lines row shape (ledger / bill_sync / print_jobs). */
export type BillSyncPaymentLine = {
  method: BillSyncPaymentLineMethod;
  amount: string;
};

/** Sole parse/normalize for collect + invoice + ledger. */
export function parseBillSyncPaymentMethod(
  raw: string | null | undefined,
): BillSyncPaymentMethod | null {
  const m = (raw ?? '').trim().toUpperCase();
  return (BILL_SYNC_PAYMENT_METHODS as readonly string[]).includes(m)
    ? (m as BillSyncPaymentMethod)
    : null;
}

/** Sole thermal/fiscal tender label from a line method (never hardcode Cash elsewhere). */
export function receiptPaymentMethodLabel(
  method: string | null | undefined,
): string {
  const m = (method ?? '').trim().toUpperCase();
  switch (m) {
    case 'CASH':
      return 'Dinheiro';
    case 'MULTIBANCO':
      return 'Multibanco';
    case 'MIXED':
      return 'Multibanco'; // should not print alone; prefer payment_lines
    default:
      return 'Dinheiro';
  }
}

export type BillSyncDocumentType = 'FT' | 'FS';

/** CIVA art.40 services threshold (gross IVA-included euro). */
export const BILL_SYNC_FS_GROSS_THRESHOLD = 100;

/**
 * Sole document_type from payment + discounted gross.
 * CASH and gross ≤ 100 → FS; CASH > 100 or MULTIBANCO/MIXED → FT.
 */
export function billSyncDocumentTypeForPayment(
  paymentMethod: string | null | undefined,
  grossTotal?: number | null,
): BillSyncDocumentType {
  const m = (paymentMethod ?? '').trim().toUpperCase();
  if (m !== 'CASH' && m !== '') return 'FT';
  const gross =
    typeof grossTotal === 'number' && Number.isFinite(grossTotal)
      ? Math.round(grossTotal * 100) / 100
      : 0;
  return gross > BILL_SYNC_FS_GROSS_THRESHOLD ? 'FT' : 'FS';
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

/**
 * Sole collect/invoice tender normalize.
 * MIXED requires both sides >0; card=full → MULTIBANCO; builds payment_lines.
 */
export function resolveCollectPaymentTender(input: {
  uiMethod: BillSyncPaymentMethod;
  dueAmount: number;
  /** Multibanco slice when uiMethod is MIXED (cash = due − this). */
  multibancoAmount?: number | null;
}):
  | {
      ok: true;
      paymentMethod: BillSyncPaymentMethod;
      payment_lines: BillSyncPaymentLine[];
      cashPortion: number;
      multibancoPortion: number;
    }
  | { ok: false; error: 'mixed_need_both_sides' | 'invalid_amount' } {
  const due = Math.round(input.dueAmount * 100) / 100;
  if (!(due > 0) || !Number.isFinite(due)) return { ok: false, error: 'invalid_amount' };

  if (input.uiMethod === 'CASH') {
    return {
      ok: true,
      paymentMethod: 'CASH',
      payment_lines: [{ method: 'CASH', amount: formatBillSyncMoney(due) }],
      cashPortion: due,
      multibancoPortion: 0,
    };
  }

  if (input.uiMethod === 'MULTIBANCO') {
    return {
      ok: true,
      paymentMethod: 'MULTIBANCO',
      payment_lines: [{ method: 'MULTIBANCO', amount: formatBillSyncMoney(due) }],
      cashPortion: 0,
      multibancoPortion: due,
    };
  }

  const cardRaw = input.multibancoAmount;
  const card =
    typeof cardRaw === 'number' && Number.isFinite(cardRaw)
      ? Math.round(cardRaw * 100) / 100
      : NaN;
  if (!(card > 0) || card > due) return { ok: false, error: 'mixed_need_both_sides' };
  const cash = Math.round((due - card) * 100) / 100;
  // Card = full due → normalize to MULTIBANCO (before cash>0 gate).
  if (card === due || !(cash > 0)) {
    if (card === due) {
      return {
        ok: true,
        paymentMethod: 'MULTIBANCO',
        payment_lines: [{ method: 'MULTIBANCO', amount: formatBillSyncMoney(due) }],
        cashPortion: 0,
        multibancoPortion: due,
      };
    }
    return { ok: false, error: 'mixed_need_both_sides' };
  }
  return {
    ok: true,
    paymentMethod: 'MIXED',
    payment_lines: [
      { method: 'MULTIBANCO', amount: formatBillSyncMoney(card) },
      { method: 'CASH', amount: formatBillSyncMoney(cash) },
    ],
    cashPortion: cash,
    multibancoPortion: card,
  };
}

/** Validate payment_lines for MIXED (fail-closed). */
export function validatePaymentLinesForMethod(
  method: BillSyncPaymentMethod,
  lines: BillSyncPaymentLine[] | null | undefined,
  dueAmount: number,
): string | null {
  const due = Math.round(dueAmount * 100) / 100;
  if (method !== 'MIXED') return null;
  if (!Array.isArray(lines) || lines.length < 2) return 'missing_payment_lines';
  let sum = 0;
  let hasCash = false;
  let hasMb = false;
  for (const line of lines) {
    if (line.method !== 'CASH' && line.method !== 'MULTIBANCO') return 'invalid_payment_lines';
    if (!isValidBillSyncMoneyString(line.amount)) return 'invalid_payment_lines';
    const n = Number(line.amount);
    if (!(n > 0)) return 'invalid_payment_lines';
    sum = Math.round((sum + n) * 100) / 100;
    if (line.method === 'CASH') hasCash = true;
    if (line.method === 'MULTIBANCO') hasMb = true;
  }
  if (!hasCash || !hasMb) return 'invalid_payment_lines';
  if (Math.abs(sum - due) > 0.009) return 'payment_lines_amount_mismatch';
  return null;
}

/** Sole parse for ledger / API payment_lines jsonb. */
export function parseBillSyncPaymentLines(
  raw: unknown,
): BillSyncPaymentLine[] | null {
  if (!Array.isArray(raw)) return null;
  const out: BillSyncPaymentLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const method = String((row as { method?: unknown }).method ?? '')
      .trim()
      .toUpperCase();
    const amount = String((row as { amount?: unknown }).amount ?? '').trim();
    if (method !== 'CASH' && method !== 'MULTIBANCO') return null;
    if (!isValidBillSyncMoneyString(amount)) return null;
    out.push({ method, amount });
  }
  return out;
}

/** Cash drawer when pure CASH or MIXED with cash portion > 0. */
export function shouldOpenCashDrawerForTender(
  method: BillSyncPaymentMethod,
  lines: BillSyncPaymentLine[] | null | undefined,
): boolean {
  if (method === 'CASH') return true;
  if (method !== 'MIXED' || !Array.isArray(lines)) return false;
  return lines.some(
    (line) => line.method === 'CASH' && Number(line.amount) > 0,
  );
}

export type BillSyncPayload = {
  request_id: string;
  source_system: 'farvoo';
  source_sale_id: string;
  table_display_name: string;
  scope_type: BillSyncScopeType;
  lines?: BillSyncLine[];
  gross_total?: string;
  splits?: BillSyncSplit[];
  auto_issue?: boolean;
  customer_nif?: string;
  customer_name?: string;
  payment_method?: BillSyncPaymentMethod | string;
  /** Sole multi-tender rows; required when payment_method is MIXED. */
  payment_lines?: BillSyncPaymentLine[];
  document_type?: BillSyncDocumentType;
  issue_mode?: 'whole_table' | 'person';
  issue_scope_id?: string;
  scope_id?: string;
  reprint_document_id?: string;
};

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

  if (payload.auto_issue) {
    const pm = parseBillSyncPaymentMethod(
      typeof payload.payment_method === 'string' ? payload.payment_method : null,
    );
    if (!pm) return 'invalid_payment_method';
    const gross =
      payload.scope_type === 'whole_table'
        ? Number(payload.gross_total)
        : Number(payload.splits?.[0]?.gross_total ?? NaN);
    const linesErr = validatePaymentLinesForMethod(
      pm,
      payload.payment_lines,
      Number.isFinite(gross) ? gross : 0,
    );
    if (linesErr) return linesErr;
  }

  return null;
}
