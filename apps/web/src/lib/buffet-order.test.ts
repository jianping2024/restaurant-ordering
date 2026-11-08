import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import {
  applyTableBuffetLineToOrderItems,
  buildBuffetBaseLine,
  buffetDraftClearsHeadcount,
  buffetFormAlignKey,
  computeBuffetSubtotal,
  currentTableBuffet,
  currentTableBuffetLine,
  effectiveTableBuffet,
  formatBuffetGuestCountsOptional,
  formatBuffetHeadcountLabel,
  formatBuffetPriceTemplate,
  formatBuffetReceiptQtyLabel,
  buffetHeadcountTokenParts,
  buffetHeadcountTokens,
  isTableBuffetUnchanged,
  listActiveBuffetLineSummaries,
  resolveBuffetFormAlignState,
  resolveBuffetOpenPricePreview,
  aggregateBuffetHeadcountForOrders,
  totalGuestsFromCounts,
  BUFFET_MIN_GUEST_COUNT,
  BUFFET_SIDE_DISABLED,
  buffetGuestCountViolation,
  buffetGuestRuleFor,
  formatBuffetGuestCountViolationMessage,
  parseBuffetGuestCountViolation,
} from '@/lib/buffet-order';
import {
  mergeBuffetPricesPreferLocked,
  resolvedBuffetPriceFromLockedLine,
  resolvedBuffetPricesFromOrders,
} from '@/lib/buffet-locked-prices';

const labels = { adults: '{n}成人', children: '{n}儿童' };
const buffetA = { id: 'buffet-a', name: 'Simple Buffet' };
const buffetB = { id: 'buffet-b', name: 'Premium Buffet' };
const resolved = {
  adult_price: 20,
  child_price: 10,
  rule_id: 'rule-1',
  time_slot_id: 'slot-1',
  adult_enabled: true,
  child_enabled: true,
};

function buffetLine(
  buffet: { id: string; name: string },
  adults: number,
  children: number,
  addedAt: string,
): NonNullable<ReturnType<typeof buildBuffetBaseLine>> {
  const line = buildBuffetBaseLine({
    buffet,
    adultCount: adults,
    childCount: children,
    resolved,
  });
  assert.ok(line);
  return { ...line, added_at: addedAt };
}

function orderWithItems(items: ReturnType<typeof buildBuffetBaseLine>[]): Order {
  const active = items.filter(Boolean) as NonNullable<ReturnType<typeof buildBuffetBaseLine>>[];
  return {
    id: 'o1',
    restaurant_id: 'r1',
    session_id: 's1',
    table_id: 't1',
    display_name: 'A1',
    status: 'done',
    items: active,
    total_amount: active.reduce((sum, line) => sum + line.price, 0),
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
  };
}

describe('current table buffet', () => {
  it('sums adults+children via one totalGuests helper', () => {
    assert.equal(totalGuestsFromCounts({ adults: 2, children: 1 }), 3);
    assert.equal(totalGuestsFromCounts(null), 0);
  });

  it('reads the newest active buffet line as the current package', () => {
    const orders = [orderWithItems([
      buffetLine(buffetA, 2, 1, '2026-01-01T10:00:00.000Z'),
      buffetLine(buffetB, 1, 0, '2026-01-01T10:01:00.000Z'),
    ])];
    assert.deepEqual(currentTableBuffet(orders), { buffetId: buffetB.id, adults: 1, children: 0 });
    // Readers of what is on paper still see every active line (legacy multi-package bills).
    assert.deepEqual(aggregateBuffetHeadcountForOrders(orders), { adults: 3, children: 1 });
    assert.equal(listActiveBuffetLineSummaries(orders).length, 2);
  });

  it('ignores voided lines; no active line → null', () => {
    const voided = { ...buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z'), item_status: 'voided' as const };
    assert.equal(currentTableBuffet([orderWithItems([voided])]), null);
    assert.equal(currentTableBuffetLine([]), null);
  });

  it('keeps package id at 0 + 0 when comparing', () => {
    const orders = [orderWithItems([buffetLine(buffetA, 2, 1, '2026-01-01T10:00:00.000Z')])];
    assert.equal(isTableBuffetUnchanged(orders, { buffetId: buffetA.id, adults: 2, children: 1 }), true);
    assert.equal(isTableBuffetUnchanged(orders, { buffetId: buffetB.id, adults: 2, children: 1 }), false);
    assert.equal(isTableBuffetUnchanged([], { buffetId: buffetA.id, adults: 0, children: 0 }), false);
    assert.deepEqual(effectiveTableBuffet({ buffetId: buffetA.id, adults: 0, children: 0 }), {
      buffetId: buffetA.id,
      adults: 0,
      children: 0,
    });
    const zeroOrders = [orderWithItems([buffetLine(buffetA, 0, 0, '2026-01-01T10:00:00.000Z')])];
    assert.deepEqual(currentTableBuffet(zeroOrders), {
      buffetId: buffetA.id,
      adults: 0,
      children: 0,
    });
    assert.equal(
      isTableBuffetUnchanged(zeroOrders, { buffetId: buffetA.id, adults: 0, children: 0 }),
      true,
    );
  });
});

describe('resolveBuffetFormAlignState', () => {
  it('returns idle with the default package', () => {
    assert.deepEqual(
      resolveBuffetFormAlignState({
        detailLoaded: true,
        hasOpenSession: false,
        orders: [],
        defaultBuffetId: buffetA.id,
      }),
      { mode: 'idle', defaultBuffetId: buffetA.id },
    );
  });

  it('returns session_open when session exists without buffet lines', () => {
    assert.deepEqual(
      resolveBuffetFormAlignState({
        detailLoaded: true,
        hasOpenSession: true,
        orders: [],
        defaultBuffetId: buffetA.id,
      }),
      { mode: 'session_open', defaultBuffetId: buffetA.id },
    );
  });

  it('returns occupied selection from orders', () => {
    const orders = [orderWithItems([buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z')])];
    assert.deepEqual(
      resolveBuffetFormAlignState({
        detailLoaded: true,
        hasOpenSession: false,
        orders,
        defaultBuffetId: buffetB.id,
      }),
      { mode: 'occupied', selection: { buffetId: buffetA.id, adults: 2, children: 0 } },
    );
  });

  it('builds stable align keys', () => {
    const occupied = resolveBuffetFormAlignState({
      detailLoaded: true,
      hasOpenSession: false,
      orders: [orderWithItems([buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z')])],
      defaultBuffetId: buffetA.id,
    });
    assert.equal(buffetFormAlignKey('t1', 's1', occupied), 't1:s1:occupied:buffet-a:2:0');
    const idleNoPackages = resolveBuffetFormAlignState({
      detailLoaded: true,
      hasOpenSession: true,
      orders: [],
      defaultBuffetId: null,
    });
    const idleWithPackage = resolveBuffetFormAlignState({
      detailLoaded: true,
      hasOpenSession: true,
      orders: [],
      defaultBuffetId: buffetA.id,
    });
    // Packages arriving later must realign the draft (else no package stays picked).
    assert.notEqual(
      buffetFormAlignKey('t1', 's1', idleNoPackages),
      buffetFormAlignKey('t1', 's1', idleWithPackage),
    );
  });
});

describe('buffetDraftClearsHeadcount', () => {
  const orders = [orderWithItems([buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z')])];

  it('flags an all-zero draft on a table with guests', () => {
    assert.equal(
      buffetDraftClearsHeadcount(orders, { buffetId: buffetA.id, adults: 0, children: 0 }),
      true,
    );
    assert.equal(buffetDraftClearsHeadcount(orders, null), true);
  });

  it('allows non-zero drafts and tables without guests', () => {
    assert.equal(
      buffetDraftClearsHeadcount(orders, { buffetId: buffetA.id, adults: 1, children: 0 }),
      false,
    );
    assert.equal(
      buffetDraftClearsHeadcount([], { buffetId: buffetA.id, adults: 0, children: 0 }),
      false,
    );
  });
});

describe('applyTableBuffetLineToOrderItems', () => {
  it('voids every active package and appends the one new line', () => {
    const lineA = buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z');
    const lineB = buffetLine(buffetB, 1, 0, '2026-01-01T10:01:00.000Z');
    const nextB = buffetLine(buffetB, 2, 1, '2026-01-01T11:00:00.000Z');
    const merged = applyTableBuffetLineToOrderItems([lineA, lineB], nextB);

    const active = merged.filter((item) => item.kind === 'buffet_base' && item.item_status !== 'voided');
    assert.equal(active.length, 1);
    assert.equal(active[0].buffet_id, buffetB.id);
    assert.equal(active[0].child_count, 1);
    assert.equal(merged.filter((item) => item.item_status === 'voided').length, 2);
  });

  it('clears the buffet when the line is null', () => {
    const lineA = buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z');
    const merged = applyTableBuffetLineToOrderItems([lineA], null);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].item_status, 'voided');
  });
});

describe('formatBuffetGuestCountsOptional', () => {
  it('shows both segments when counts are positive', () => {
    assert.equal(formatBuffetGuestCountsOptional(2, 1, labels), '2成人 · 1儿童');
  });
});

describe('formatBuffetHeadcountLabel', () => {
  it('joins non-zero adult and child with a space', () => {
    assert.equal(formatBuffetHeadcountLabel(7, 3), 'A7 C3');
    assert.equal(formatBuffetHeadcountLabel(2, 0), 'A2');
    assert.equal(formatBuffetHeadcountLabel(0, 1), 'C1');
    assert.equal(formatBuffetHeadcountLabel(0, 0), '');
  });
});

describe('buffetHeadcountTokens', () => {
  it('mints sole A/C strings; zero side is null', () => {
    assert.deepEqual(buffetHeadcountTokens(3, 2), { adult: 'A3', child: 'C2' });
    assert.deepEqual(buffetHeadcountTokens(2, 0), { adult: 'A2', child: null });
    assert.deepEqual(buffetHeadcountTokens(0, 1), { adult: null, child: 'C1' });
    assert.deepEqual(buffetHeadcountTokens(0, 0), { adult: null, child: null });
  });
});

describe('buffetHeadcountTokenParts', () => {
  it('returns adult-first A/C tokens without joining', () => {
    assert.deepEqual(buffetHeadcountTokenParts(3, 2), ['A3', 'C2']);
    assert.deepEqual(buffetHeadcountTokenParts(2, 0), ['A2']);
    assert.deepEqual(buffetHeadcountTokenParts(0, 1), ['C1']);
    assert.deepEqual(buffetHeadcountTokenParts(0, 0), []);
  });
});

describe('formatBuffetReceiptQtyLabel', () => {
  it('joins non-zero adult and child with a hyphen', () => {
    assert.equal(formatBuffetReceiptQtyLabel(4, 2), 'A4-C2');
    assert.equal(formatBuffetReceiptQtyLabel(2, 0), 'A2');
  });
});

describe('formatBuffetPriceTemplate', () => {
  it('interpolates estimated total', () => {
    const line = formatBuffetPriceTemplate('预计合计：€{total}', { total: 69 });
    assert.equal(line, '预计合计：€69.00');
  });
});

describe('computeBuffetSubtotal / resolveBuffetOpenPricePreview', () => {
  it('computes subtotal from headcount and unit prices', () => {
    assert.equal(computeBuffetSubtotal(3, 3, 14.5, 8.5), 69);
  });

  it('resolves open-table preview from RPC row', () => {
    const preview = resolveBuffetOpenPricePreview(resolved, 3, 3);
    assert.deepEqual(preview, {
      ok: true,
      adultPrice: 20,
      childPrice: 10,
      adultEnabled: true,
      childEnabled: true,
      subtotal: 90,
    });
  });

  it('carries rule side toggles into the preview', () => {
    const preview = resolveBuffetOpenPricePreview({ ...resolved, child_enabled: false }, 2, 0);
    assert.equal(preview.ok && preview.childEnabled, false);
    assert.equal(preview.ok && preview.adultEnabled, true);
  });
});

describe('resolvedBuffetPriceFromLockedLine / mergeBuffetPricesPreferLocked', () => {
  it('reads open-time unit prices from a zero-headcount buffet_base line', () => {
    const line = buffetLine(buffetA, 0, 0, '2026-01-01T12:00:00.000Z');
    assert.deepEqual(resolvedBuffetPriceFromLockedLine(line), {
      adult_price: 20,
      child_price: 10,
      rule_id: 'rule-1',
      time_slot_id: null,
      adult_enabled: true,
      child_enabled: true,
    });
  });

  it('prefers locked open-time prices over a different live RPC row', () => {
    const orders = [orderWithItems([buffetLine(buffetA, 0, 0, '2026-01-01T12:00:00.000Z')])];
    const live = {
      [buffetA.id]: {
        adult_price: 99,
        child_price: 88,
        rule_id: 'live-rule',
        time_slot_id: 'live-slot',
        adult_enabled: true,
        child_enabled: false,
      },
    };
    // Locked unit prices win; toggles come from the live (current) rule.
    assert.deepEqual(mergeBuffetPricesPreferLocked(live, orders)[buffetA.id], {
      adult_price: 20,
      child_price: 10,
      rule_id: 'rule-1',
      time_slot_id: null,
      adult_enabled: true,
      child_enabled: false,
    });
    // No live row (out of slot) → both sides on.
    assert.equal(mergeBuffetPricesPreferLocked({}, orders)[buffetA.id]?.child_enabled, true);
    assert.deepEqual(resolvedBuffetPricesFromOrders(orders)[buffetA.id]?.adult_price, 20);
  });

  it('returns null when unit prices are missing on the line', () => {
    const line = buffetLine(buffetA, 1, 0, '2026-01-01T12:00:00.000Z');
    const rest = {
      price_rule_id: line.price_rule_id,
    };
    assert.equal(resolvedBuffetPriceFromLockedLine(rest), null);
  });
});

describe('buffetGuestCountViolation', () => {
  const on = { minGuestCount: 0, adultEnabled: true, childEnabled: true };
  const cases: Array<{
    name: string;
    rule: { minGuestCount: number; adultEnabled: boolean; childEnabled: boolean };
    adults: number;
    children: number;
    want: ReturnType<typeof buffetGuestCountViolation>;
  }> = [
    { name: 'no minimum, 0 guests', rule: on, adults: 0, children: 0, want: null },
    { name: 'min 2, 1 adult', rule: { ...on, minGuestCount: 2 }, adults: 1, children: 0,
      want: { code: BUFFET_MIN_GUEST_COUNT, min: 2, total: 1 } },
    { name: 'min 2, 1 adult + 1 child', rule: { ...on, minGuestCount: 2 }, adults: 1, children: 1, want: null },
    { name: 'min 2, 0 guests', rule: { ...on, minGuestCount: 2 }, adults: 0, children: 0,
      want: { code: BUFFET_MIN_GUEST_COUNT, min: 2, total: 0 } },
    { name: 'child off, child > 0', rule: { ...on, childEnabled: false }, adults: 2, children: 1,
      want: { code: BUFFET_SIDE_DISABLED, side: 'children' } },
    { name: 'adult off, adult > 0', rule: { ...on, adultEnabled: false }, adults: 1, children: 2,
      want: { code: BUFFET_SIDE_DISABLED, side: 'adults' } },
    { name: 'side checked before minimum', rule: { minGuestCount: 5, adultEnabled: true, childEnabled: false },
      adults: 1, children: 1, want: { code: BUFFET_SIDE_DISABLED, side: 'children' } },
    { name: 'child off, adults meet minimum', rule: { minGuestCount: 2, adultEnabled: true, childEnabled: false },
      adults: 2, children: 0, want: null },
  ];
  for (const c of cases) {
    it(c.name, () => {
      assert.deepEqual(
        buffetGuestCountViolation({ ...c.rule, adults: c.adults, children: c.children }),
        c.want,
      );
    });
  }

  it('round-trips through the server message', () => {
    for (const c of cases) {
      if (!c.want) continue;
      assert.deepEqual(
        parseBuffetGuestCountViolation(c.want.code, formatBuffetGuestCountViolationMessage(c.want)),
        c.want,
      );
    }
    assert.equal(parseBuffetGuestCountViolation('conflict', 'x'), null);
  });

  it('buffetGuestRuleFor defaults: min 0, both sides on', () => {
    assert.deepEqual(buffetGuestRuleFor(null, null), on);
    assert.deepEqual(
      buffetGuestRuleFor({ min_guest_count: 3 }, { adult_enabled: false, child_enabled: true }),
      { minGuestCount: 3, adultEnabled: false, childEnabled: true },
    );
  });
});
