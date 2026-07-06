import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import {
  buildBuffetBaseLine,
  buffetFormAlignKey,
  buffetSnapshotFromOrders,
  buffetSnapshotKey,
  buffetSnapshotsEqual,
  buildIdleBuffetDraftSnapshot,
  computeBuffetSubtotal,
  deriveBuffetFormSnapshot,
  diffBuffetSnapshots,
  formatBuffetCompactHeadcountLabel,
  formatBuffetGuestCountsOptional,
  formatBuffetPriceTemplate,
  formatBuffetReceiptQtyLabel,
  isBuffetSnapshotUnchanged,
  listActiveBuffetLineSummaries,
  resolveBuffetFormAlignState,
  resolveBuffetOpenPricePreview,
  snapshotFromBuffetEntries,
  upsertBuffetLineOntoOrderItems,
  aggregateBuffetHeadcountForOrders,
} from '@/lib/buffet-order';

const labels = { adults: '{n}大人', children: '{n}小孩' };
const buffetA = { id: 'buffet-a', name: 'Simple Buffet' };
const buffetB = { id: 'buffet-b', name: 'Premium Buffet' };
const resolved = {
  adult_price: 20,
  child_price: 10,
  rule_id: 'rule-1',
  time_slot_id: 'slot-1',
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

describe('buffet snapshot', () => {
  it('reads multiple active packages from orders', () => {
    const orders = [orderWithItems([
      buffetLine(buffetA, 2, 1, '2026-01-01T10:00:00.000Z'),
      buffetLine(buffetB, 1, 0, '2026-01-01T10:01:00.000Z'),
    ])];

    assert.deepEqual(buffetSnapshotFromOrders(orders), {
      [buffetA.id]: { adults: 2, children: 1 },
      [buffetB.id]: { adults: 1, children: 0 },
    });
    assert.deepEqual(aggregateBuffetHeadcountForOrders(orders), { adults: 3, children: 1 });
    assert.equal(listActiveBuffetLineSummaries(orders).length, 2);
  });

  it('detects unchanged and changed snapshots', () => {
    const orders = [orderWithItems([buffetLine(buffetA, 2, 1, '2026-01-01T10:00:00.000Z')])];
    const same = snapshotFromBuffetEntries([
      { buffetId: buffetA.id, adults: 2, children: 1 },
    ]);
    const changed = snapshotFromBuffetEntries([
      { buffetId: buffetA.id, adults: 3, children: 1 },
      { buffetId: buffetB.id, adults: 1, children: 0 },
    ]);

    assert.equal(isBuffetSnapshotUnchanged(orders, same), true);
    assert.equal(isBuffetSnapshotUnchanged(orders, changed), false);
  });

  it('diffs upsert and void package ids', () => {
    const current = {
      [buffetA.id]: { adults: 2, children: 1 },
      [buffetB.id]: { adults: 1, children: 0 },
    };
    const target = {
      [buffetA.id]: { adults: 3, children: 0 },
    };
    assert.deepEqual(diffBuffetSnapshots(current, target), {
      voidBuffetIds: [buffetB.id],
      upsertBuffetIds: [buffetA.id],
    });
  });
});

describe('deriveBuffetFormSnapshot / align', () => {
  it('returns idle draft with first package defaulted', () => {
    assert.deepEqual(
      resolveBuffetFormAlignState({
        detailLoaded: true,
        orders: [],
        activeBuffetIds: [buffetA.id, buffetB.id],
        defaultBuffetId: buffetA.id,
      }),
      {
        mode: 'idle',
        defaultBuffetId: buffetA.id,
        activeBuffetIds: [buffetA.id, buffetB.id],
      },
    );
    assert.deepEqual(buildIdleBuffetDraftSnapshot([buffetA.id, buffetB.id], buffetA.id), {
      [buffetA.id]: { adults: 2, children: 0 },
      [buffetB.id]: { adults: 0, children: 0 },
    });
  });

  it('returns occupied snapshot from orders', () => {
    const orders = [orderWithItems([buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z')])];
    assert.deepEqual(deriveBuffetFormSnapshot(orders), {
      [buffetA.id]: { adults: 2, children: 0 },
    });
    assert.deepEqual(
      resolveBuffetFormAlignState({
        detailLoaded: true,
        orders,
        activeBuffetIds: [buffetA.id, buffetB.id],
        defaultBuffetId: buffetA.id,
      }),
      {
        mode: 'occupied',
        snapshot: { [buffetA.id]: { adults: 2, children: 0 } },
      },
    );
  });

  it('builds stable align keys', () => {
    const occupied = resolveBuffetFormAlignState({
      detailLoaded: true,
      orders: [orderWithItems([buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z')])],
      activeBuffetIds: [buffetA.id],
      defaultBuffetId: buffetA.id,
    });
    assert.equal(buffetSnapshotKey({ [buffetA.id]: { adults: 2, children: 0 } }), 'buffet-a:2:0');
    assert.ok(buffetFormAlignKey('t1', 's1', occupied).includes('occupied'));
    assert.equal(buffetSnapshotsEqual({ a: { adults: 1, children: 0 } }, { a: { adults: 1, children: 0 } }), true);
  });
});

describe('upsertBuffetLineOntoOrderItems', () => {
  it('keeps other packages when upserting one package', () => {
    const lineA = buffetLine(buffetA, 2, 0, '2026-01-01T10:00:00.000Z');
    const lineB = buffetLine(buffetB, 1, 0, '2026-01-01T10:01:00.000Z');
    const nextB = buffetLine(buffetB, 2, 1, '2026-01-01T11:00:00.000Z');
    const merged = upsertBuffetLineOntoOrderItems([lineA, lineB], nextB);

    const active = merged.filter((item) => item.kind === 'buffet_base' && item.item_status !== 'voided');
    assert.equal(active.length, 2);
    assert.equal(active.find((item) => item.buffet_id === buffetA.id)?.adult_count, 2);
    assert.equal(active.find((item) => item.buffet_id === buffetB.id)?.adult_count, 2);
    assert.equal(active.find((item) => item.buffet_id === buffetB.id)?.child_count, 1);
    assert.equal(merged.filter((item) => item.item_status === 'voided').length, 1);
  });
});

describe('formatBuffetGuestCountsOptional', () => {
  it('shows both segments when counts are positive', () => {
    assert.equal(formatBuffetGuestCountsOptional(2, 1, labels), '2大人 · 1小孩');
  });
});

describe('formatBuffetCompactHeadcountLabel', () => {
  it('joins adult and child without separator', () => {
    assert.equal(formatBuffetCompactHeadcountLabel(3, 2), 'A3C2');
  });
});

describe('formatBuffetReceiptQtyLabel', () => {
  it('shows adult and child with hyphen', () => {
    assert.equal(formatBuffetReceiptQtyLabel(4, 2), 'A4-C2');
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
      subtotal: 90,
    });
  });
});
