/**
 * Sole Farvoo bill-sync job payload builder (bill-sync-contract-v1.0).
 * whole_table | even | custom → whole_table; by_item → split. No parallel builders.
 */
import { consumersForLineFromPersons } from '@/lib/bill-split-by-item';
import {
  buildByItemLineSpec,
  buildByItemSplitOrderLines,
} from '@/lib/bill-split-by-item-lines';
import {
  billableLineAmount,
  buildBillableSessionItems,
} from '@/lib/billable-session-lines';
import {
  buildBillSyncLine,
  type BillSyncLine,
  type BillSyncPayload,
  type BillSyncSplit,
  validateBillSyncPayload,
} from '@/lib/bill-sync-payload';
import { billSyncByItemScopeId } from '@/lib/bill-sync-scope-id';
import { buildSplitPersonShareLines } from '@/lib/checkout-split-person-lines';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { isBuffetBaseItem } from '@/lib/order-items';
import { splitPersonKey } from '@/lib/split-person-identity';
import type { BillSplit, Order, OrderItem, SplitMode, SplitPerson } from '@/types';

/**
 * Sole fiscal item_code for a billable line (menu snapshot or buffet_base).
 * Buffet has no catalog item_code — stable `BF` + first 8 hex of buffet uuid.
 */
export function resolveBillSyncItemCode(
  item: OrderItem,
  itemCodeByMenuId: Record<string, string>,
): string {
  const fromMenu = (resolveMenuItemCode(item, itemCodeByMenuId) ?? '').trim();
  if (fromMenu) return fromMenu;
  if (!isBuffetBaseItem(item)) return '';
  const buffetId = (item.buffet_id || item.id.replace(/^buffet:/, '')).replace(/-/g, '');
  if (buffetId.length < 8) return '';
  return `BF${buffetId.slice(0, 8).toUpperCase()}`;
}

export type BuildBillSyncPayloadInput = {
  requestId: string;
  billSplitId: string;
  tableDisplayName: string;
  splitMode: SplitMode;
  persons: SplitPerson[];
  orders: Order[];
  itemCodeByMenuId: Record<string, string>;
  vatRateByMenuId: Record<string, number>;
  defaultVatRatePercent: number;
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

function buildWholeTableLines(input: BuildBillSyncPayloadInput): BillSyncLine[] | { error: string } {
  const lines: BillSyncLine[] = [];
  for (const row of buildBillableSessionItems(input.orders)) {
    const { item } = row;
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
    const built = buildBillSyncLine({
      item_code: itemCode,
      name: resolveMenuItemLocalizedName(item, 'pt'),
      qty,
      unit_price_gross: unit,
      line_gross: lineGross,
      vat_rate_percent: vatPercentForItem(item, input.vatRateByMenuId, input.defaultVatRatePercent),
    });
    if ('error' in built) return { error: built.error };
    lines.push(built);
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

      const itemCode = resolveBillSyncItemCode(catalogLine, input.itemCodeByMenuId);
      if (!itemCode) return { error: 'empty_item_code' };

      const built = buildBillSyncLine({
        item_code: itemCode,
        name: resolveMenuItemLocalizedName(catalogLine, 'pt'),
        qty,
        unit_price_gross: share.shareAmount / qty,
        line_gross: share.shareAmount,
        vat_rate_percent: vatPercentForItem(
          catalogLine,
          input.vatRateByMenuId,
          input.defaultVatRatePercent,
        ),
      });
      if ('error' in built) return { error: built.error };
      lines.push(built);
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

  let payload: BillSyncPayload;
  if (input.splitMode === 'by_item') {
    const splits = buildByItemSplits(input);
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

  const invalid = validateBillSyncPayload(payload);
  if (invalid) return { ok: false, error: invalid };
  return { ok: true, payload };
}
