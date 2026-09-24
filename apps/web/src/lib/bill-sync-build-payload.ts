/**
 * Sole Farvoo bill-sync job payload builder (bill-sync-contract-v1.0 + auto_issue).
 * by_item | even | custom (2+ people) → split; whole_table or single person → whole_table.
 */
import {
  buffetShareUnitPrice,
  consumersForLineFromPersons,
  type BuffetGuestType,
} from '@/lib/bill-split-by-item';
import {
  buildByItemLineSpec,
  buildByItemSplitOrderLines,
} from '@/lib/bill-split-by-item-lines';
import {
  billableLineAmount,
  buildBillableSessionItems,
} from '@/lib/billable-session-lines';
import {
  billSyncDocumentTypeForPayment,
  buildBillSyncLine,
  type BillSyncDocumentType,
  type BillSyncLine,
  type BillSyncPayload,
  type BillSyncPaymentMethod,
  type BillSyncSplit,
  validateBillSyncPayload,
} from '@/lib/bill-sync-payload';
import { billSyncByItemScopeId } from '@/lib/bill-sync-scope-id';
import { buildSplitPersonShareLines } from '@/lib/checkout-split-person-lines';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import {
  allocateEvenAmounts,
  allocateProportionalCents,
  eurosToCents,
  centsToEuros,
} from '@/lib/money-allocation';
import { isBuffetBaseItem } from '@/lib/order-items';
import { splitPersonKey } from '@/lib/split-person-identity';
import type { BillSplit, Order, OrderItem, SplitMode, SplitPerson, SplitResult } from '@/types';

/**
 * Sole fiscal item_code for a billable line (menu snapshot or buffet_base).
 * Buffet: stable `BF` + first 8 hex of buffet uuid + `A`|`C` (adult|child).
 * Never mint a bare BF######## — adult/child must not share one code.
 */
export function resolveBillSyncItemCode(
  item: OrderItem,
  itemCodeByMenuId: Record<string, string>,
  buffetGuest?: BuffetGuestType | null,
): string {
  const fromMenu = (resolveMenuItemCode(item, itemCodeByMenuId) ?? '').trim();
  if (fromMenu) return fromMenu;
  if (!isBuffetBaseItem(item)) return '';
  if (buffetGuest !== 'adult' && buffetGuest !== 'child') return '';
  const buffetId = (item.buffet_id || item.id.replace(/^buffet:/, '')).replace(/-/g, '');
  if (buffetId.length < 8) return '';
  const suffix = buffetGuest === 'child' ? 'C' : 'A';
  return `BF${buffetId.slice(0, 8).toUpperCase()}${suffix}`;
}

/** Optional Farvoo→Agent auto_issue fields (print fiscal invoice). */
export type BillSyncAutoIssueFields = {
  auto_issue: true;
  customer_nif?: string;
  customer_name?: string;
  payment_method: BillSyncPaymentMethod | string;
  document_type?: BillSyncDocumentType;
  issue_mode?: 'whole_table' | 'person';
  issue_scope_id?: string;
};

export type BuildBillSyncPayloadInput = {
  requestId: string;
  billSplitId: string;
  tableDisplayName: string;
  splitMode: SplitMode;
  persons: SplitPerson[];
  /** Required for custom proportional splits (result[].amount). */
  result?: SplitResult[];
  orders: Order[];
  itemCodeByMenuId: Record<string, string>;
  vatRateByMenuId: Record<string, number>;
  defaultVatRatePercent: number;
  autoIssue?: BillSyncAutoIssueFields | null;
};

export type BuildBillSyncPayloadResult =
  | { ok: true; payload: BillSyncPayload }
  | { ok: false; error: string };

function vatPercentForItem(
  item: OrderItem,
  vatRateByMenuId: Record<string, number>,
  defaultVatRatePercent: number,
): number {
  if (item.id && !isBuffetBaseItem(item) && typeof vatRateByMenuId[item.id] === 'number') {
    return vatRateByMenuId[item.id]!;
  }
  return defaultVatRatePercent;
}

function pushBuiltLine(
  lines: BillSyncLine[],
  input: {
    item: OrderItem;
    itemCode: string;
    qty: number;
    unitPrice: number;
    lineGross: number;
    vatRateByMenuId: Record<string, number>;
    defaultVatRatePercent: number;
  },
): { error: string } | null {
  const built = buildBillSyncLine({
    item_code: input.itemCode,
    name: resolveMenuItemLocalizedName(input.item, 'pt'),
    qty: input.qty,
    unit_price_gross: input.unitPrice,
    line_gross: input.lineGross,
    vat_rate_percent: vatPercentForItem(
      input.item,
      input.vatRateByMenuId,
      input.defaultVatRatePercent,
    ),
  });
  if ('error' in built) return { error: built.error };
  lines.push(built);
  return null;
}

/** Whole-table buffet: one fiscal line per guest band (adult / child). */
function appendWholeTableBuffetLines(
  lines: BillSyncLine[],
  item: OrderItem,
  input: BuildBillSyncPayloadInput,
): { error: string } | null {
  const adults = Math.max(0, Math.floor(Number(item.adult_count) || 0));
  const children = Math.max(0, Math.floor(Number(item.child_count) || 0));
  if (adults <= 0 && children <= 0) return { error: 'empty_lines' };

  const bands: Array<{ guest: BuffetGuestType; qty: number }> = [];
  if (adults > 0) bands.push({ guest: 'adult', qty: adults });
  if (children > 0) bands.push({ guest: 'child', qty: children });

  for (const band of bands) {
    const itemCode = resolveBillSyncItemCode(item, input.itemCodeByMenuId, band.guest);
    if (!itemCode) return { error: 'empty_item_code' };
    const unit = buffetShareUnitPrice(item, band.guest);
    if (!(unit > 0)) return { error: 'invalid_money' };
    const lineGross = Math.round(unit * band.qty * 100) / 100;
    const err = pushBuiltLine(lines, {
      item,
      itemCode,
      qty: band.qty,
      unitPrice: unit,
      lineGross,
      vatRateByMenuId: input.vatRateByMenuId,
      defaultVatRatePercent: input.defaultVatRatePercent,
    });
    if (err) return err;
  }
  return null;
}

function buildWholeTableLines(input: BuildBillSyncPayloadInput): BillSyncLine[] | { error: string } {
  const lines: BillSyncLine[] = [];
  for (const row of buildBillableSessionItems(input.orders)) {
    const { item } = row;
    if (isBuffetBaseItem(item)) {
      const err = appendWholeTableBuffetLines(lines, item, input);
      if (err) return err;
      continue;
    }

    const itemCode = resolveBillSyncItemCode(item, input.itemCodeByMenuId);
    if (!itemCode) return { error: 'empty_item_code' };
    const lineGross = billableLineAmount(row);
    const qty =
      typeof row.chargeableQty === 'number' && row.chargeableQty > 0
        ? row.chargeableQty
        : item.qty;
    const unit =
      typeof row.chargeableUnitPrice === 'number'
        ? row.chargeableUnitPrice
        : qty > 0
          ? lineGross / qty
          : item.price;
    const err = pushBuiltLine(lines, {
      item,
      itemCode,
      qty,
      unitPrice: unit,
      lineGross,
      vatRateByMenuId: input.vatRateByMenuId,
      defaultVatRatePercent: input.defaultVatRatePercent,
    });
    if (err) return err;
  }
  if (lines.length === 0) return { error: 'empty_lines' };
  return lines;
}

function buildByItemSplits(input: BuildBillSyncPayloadInput): BillSyncSplit[] | { error: string } {
  const persons = input.persons ?? [];
  if (persons.length === 0) return { error: 'missing_splits' };

  const catalogByKey = new Map(
    buildByItemSplitOrderLines(input.orders).map((line) => [line.key, line]),
  );
  const shareSplit = {
    id: input.billSplitId,
    restaurant_id: '',
    table_id: '',
    display_name: input.tableDisplayName,
    order_ids: [],
    split_mode: 'by_item' as const,
    persons,
    result: [],
    total_amount: 0,
    status: 'requested' as const,
    created_at: '',
  } satisfies BillSplit;

  const splits: BillSyncSplit[] = [];

  for (let personIndex = 0; personIndex < persons.length; personIndex++) {
    const person = persons[personIndex]!;
    const name = person.name?.trim();
    if (!name) return { error: 'empty_person_name' };

    const shareRows = buildSplitPersonShareLines(
      shareSplit,
      personIndex,
      input.orders,
      'pt',
    );
    const lines: BillSyncLine[] = [];

    for (const share of shareRows) {
      if (!(share.shareAmount > 0)) continue;
      const catalogLine = catalogByKey.get(share.key);
      if (!catalogLine) return { error: 'missing_catalog_line' };

      const spec = buildByItemLineSpec(catalogLine);
      const consumers = consumersForLineFromPersons(persons, share.key, spec);
      const personShare = consumers.find(
        (c) => splitPersonKey(c.name) === splitPersonKey(name),
      );
      const qty = personShare ? personShare.qty.num / personShare.qty.den : 0;
      if (!(qty > 0)) continue;

      const buffetGuest =
        personShare?.guestType === 'adult' || personShare?.guestType === 'child'
          ? personShare.guestType
          : null;
      const itemCode = resolveBillSyncItemCode(
        catalogLine,
        input.itemCodeByMenuId,
        buffetGuest,
      );
      if (!itemCode) return { error: 'empty_item_code' };

      const unitPrice =
        isBuffetBaseItem(catalogLine) && buffetGuest
          ? buffetShareUnitPrice(catalogLine, buffetGuest)
          : share.shareAmount / qty;

      const err = pushBuiltLine(lines, {
        item: catalogLine,
        itemCode,
        qty,
        unitPrice,
        lineGross: share.shareAmount,
        vatRateByMenuId: input.vatRateByMenuId,
        defaultVatRatePercent: input.defaultVatRatePercent,
      });
      if (err) return err;
    }

    if (lines.length === 0) continue;

    const gross = lines.reduce((sum, line) => sum + Number(line.line_gross), 0);
    splits.push({
      scope_id: billSyncByItemScopeId(input.billSplitId, name),
      name,
      lines,
      gross_total: (Math.round(gross * 100) / 100).toFixed(2),
    });
  }

  if (splits.length === 0) return { error: 'empty_lines' };
  return splits;
}

type NamedWeight = { name: string; weight: number };

/**
 * Even/custom → split: allocate each whole-table line across people by weight
 * (even = equal; custom = result amounts). Uses allocateProportionalCents.
 */
function buildAmountWeightedSplits(
  input: BuildBillSyncPayloadInput,
  namedWeights: NamedWeight[],
): BillSyncSplit[] | { error: string } {
  if (namedWeights.length < 2) return { error: 'missing_splits' };
  const whole = buildWholeTableLines(input);
  if ('error' in whole) return whole;

  const names = namedWeights.map((w) => w.name);
  const weights = namedWeights.map((w) => Math.max(0, w.weight));
  if (weights.every((w) => w <= 0)) return { error: 'invalid_money' };

  const perPersonLines: BillSyncLine[][] = names.map(() => []);

  for (const line of whole) {
    const lineGrossCents = eurosToCents(Number(line.line_gross));
    const qtyMilli = Math.round(Number(line.qty) * 1000);
    const grossParts = allocateProportionalCents(lineGrossCents, weights, (i) => names[i] ?? '');
    const qtyParts =
      qtyMilli > 0
        ? allocateProportionalCents(qtyMilli, weights, (i) => names[i] ?? '')
        : weights.map(() => 0);
    const unitPrice = Number(line.unit_price_gross);

    for (let i = 0; i < names.length; i++) {
      const gross = centsToEuros(grossParts[i] ?? 0);
      const qty = (qtyParts[i] ?? 0) / 1000;
      if (!(gross > 0) || !(qty > 0)) continue;
      const built = buildBillSyncLine({
        item_code: line.item_code,
        name: line.name,
        qty,
        unit_price_gross: unitPrice,
        line_gross: gross,
        vat_rate_percent: Number(line.vat_rate),
      });
      if ('error' in built) return { error: built.error };
      perPersonLines[i]!.push(built);
    }
  }

  const splits: BillSyncSplit[] = [];
  for (let i = 0; i < names.length; i++) {
    const lines = perPersonLines[i]!;
    if (lines.length === 0) continue;
    const name = names[i]!;
    const gross = lines.reduce((sum, l) => sum + Number(l.line_gross), 0);
    splits.push({
      scope_id: billSyncByItemScopeId(input.billSplitId, name),
      name,
      lines,
      gross_total: (Math.round(gross * 100) / 100).toFixed(2),
    });
  }
  if (splits.length === 0) return { error: 'empty_lines' };
  return splits;
}

function buildEvenSplits(input: BuildBillSyncPayloadInput): BillSyncSplit[] | { error: string } {
  const names = (input.persons ?? [])
    .map((p) => p.name?.trim())
    .filter((n): n is string => Boolean(n));
  if (names.length < 2) return { error: 'missing_splits' };
  const whole = buildWholeTableLines(input);
  if ('error' in whole) return whole;
  const total = whole.reduce((sum, l) => sum + Number(l.line_gross), 0);
  const amounts = allocateEvenAmounts(total, names);
  return buildAmountWeightedSplits(
    input,
    names.map((name, i) => ({ name, weight: amounts[i] ?? 0 })),
  );
}

function buildCustomSplits(input: BuildBillSyncPayloadInput): BillSyncSplit[] | { error: string } {
  const fromResult = (input.result ?? [])
    .map((r) => ({
      name: r.name?.trim() ?? '',
      weight: typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : 0,
    }))
    .filter((r) => r.name);
  const fromPersons = (input.persons ?? [])
    .map((p) => ({
      name: p.name?.trim() ?? '',
      weight: typeof p.amount === 'number' && Number.isFinite(p.amount) ? p.amount : 0,
    }))
    .filter((p) => p.name);
  const named = fromResult.length >= 2 ? fromResult : fromPersons;
  if (named.length < 2) return { error: 'missing_splits' };
  return buildAmountWeightedSplits(input, named);
}

function applyAutoIssueFields(
  payload: BillSyncPayload,
  auto: BillSyncAutoIssueFields | null | undefined,
): BillSyncPayload | { error: string } {
  if (!auto?.auto_issue) return payload;
  const payment = String(auto.payment_method ?? '').trim().toUpperCase();
  if (!payment) return { error: 'missing_payment_method' };
  const document_type =
    auto.document_type ?? billSyncDocumentTypeForPayment(payment);
  if (document_type !== 'FT' && document_type !== 'FS') {
    return { error: 'invalid_document_type' };
  }

  const out: BillSyncPayload = {
    ...payload,
    auto_issue: true,
    payment_method: payment,
    document_type,
  };
  const nif = auto.customer_nif?.trim();
  if (nif) out.customer_nif = nif;
  const name = auto.customer_name?.trim();
  if (name) out.customer_name = name;

  if (payload.scope_type === 'split') {
    const scopeId = auto.issue_scope_id?.trim();
    if (!scopeId) return { error: 'missing_issue_scope_id' };
    out.issue_mode = auto.issue_mode ?? 'person';
    out.issue_scope_id = scopeId;
  } else {
    out.issue_mode = auto.issue_mode ?? 'whole_table';
  }
  return out;
}

/** Whether this split_mode + people count should emit scope_type=split. */
export function billSyncUsesSplitScope(
  splitMode: SplitMode,
  personCount: number,
): boolean {
  if (personCount < 2) return false;
  return splitMode === 'by_item' || splitMode === 'even' || splitMode === 'custom';
}

/** Sole snapshot builder for bill_sync_jobs.payload. */
export function buildBillSyncJobPayload(
  input: BuildBillSyncPayloadInput,
): BuildBillSyncPayloadResult {
  const tableDisplayName = input.tableDisplayName.trim() || '—';
  const base = {
    request_id: input.requestId,
    source_system: 'farvoo' as const,
    source_sale_id: input.billSplitId,
    table_display_name: tableDisplayName,
  };

  const personCount = (input.persons ?? []).filter((p) => p.name?.trim()).length;
  const useSplit = billSyncUsesSplitScope(input.splitMode, personCount);

  let payload: BillSyncPayload;
  if (useSplit && input.splitMode === 'by_item') {
    const splits = buildByItemSplits(input);
    if ('error' in splits) return { ok: false, error: splits.error };
    payload = { ...base, scope_type: 'split', splits };
  } else if (useSplit && input.splitMode === 'even') {
    const splits = buildEvenSplits(input);
    if ('error' in splits) return { ok: false, error: splits.error };
    payload = { ...base, scope_type: 'split', splits };
  } else if (useSplit && input.splitMode === 'custom') {
    const splits = buildCustomSplits(input);
    if ('error' in splits) return { ok: false, error: splits.error };
    payload = { ...base, scope_type: 'split', splits };
  } else {
    const lines = buildWholeTableLines(input);
    if ('error' in lines) return { ok: false, error: lines.error };
    const gross = lines.reduce((sum, line) => sum + Number(line.line_gross), 0);
    payload = {
      ...base,
      scope_type: 'whole_table',
      lines,
      gross_total: (Math.round(gross * 100) / 100).toFixed(2),
    };
  }

  const withAuto = applyAutoIssueFields(payload, input.autoIssue);
  if ('error' in withAuto) return { ok: false, error: withAuto.error };
  payload = withAuto;

  const invalid = validateBillSyncPayload(payload);
  if (invalid) return { ok: false, error: invalid };
  return { ok: true, payload };
}
