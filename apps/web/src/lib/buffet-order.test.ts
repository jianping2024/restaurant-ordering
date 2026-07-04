import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBuffetBaseLine,
  buffetFormAlignKey,
  buffetFormSeedKey,
  computeBuffetSubtotal,
  deriveBuffetFormSeed,
  formatBuffetGuestCountsOptional,
  formatBuffetPriceTemplate,
  formatBuffetReceiptQtyLabel,
  isBuffetGuestCountsUnchanged,
  resolveBuffetFormAlignState,
  resolveBuffetOpenPricePreview,
} from '@/lib/buffet-order';
import type { Order } from '@/types';

const labels = { adults: '{n}大人', children: '{n}小孩' };
const buffetA = { id: 'buffet-a', name: 'Lunch Buffet' };
const resolved = {
  adult_price: 20,
  child_price: 10,
  rule_id: 'rule-1',
  time_slot_id: 'slot-1',
};

function orderWithBuffet(adults: number, children: number): Order {
  const line = buildBuffetBaseLine({
    buffet: buffetA,
    adultCount: adults,
    childCount: children,
    resolved,
  });
  assert.ok(line);
  return {
    id: 'o1',
    restaurant_id: 'r1',
    session_id: 's1',
    table_id: 't1',
    display_name: 'A1',
    status: 'done',
    items: [line],
    total_amount: line.price,
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
  };
}

describe('isBuffetGuestCountsUnchanged', () => {
  it('is false when table has no active buffet', () => {
    assert.equal(isBuffetGuestCountsUnchanged([], buffetA.id, 2, 0), false);
  });

  it('is true when buffet type and adult/child counts match', () => {
    const orders = [orderWithBuffet(2, 1)];
    assert.equal(isBuffetGuestCountsUnchanged(orders, buffetA.id, 2, 1), true);
  });

  it('is false when adult count differs', () => {
    const orders = [orderWithBuffet(2, 1)];
    assert.equal(isBuffetGuestCountsUnchanged(orders, buffetA.id, 3, 1), false);
  });

  it('is false when child count differs', () => {
    const orders = [orderWithBuffet(2, 1)];
    assert.equal(isBuffetGuestCountsUnchanged(orders, buffetA.id, 2, 0), false);
  });

  it('is false when total matches but adult/child split differs', () => {
    const orders = [orderWithBuffet(2, 1)];
    assert.equal(isBuffetGuestCountsUnchanged(orders, buffetA.id, 3, 0), false);
  });
});

describe('deriveBuffetFormSeed', () => {
  it('returns null when table has no active buffet', () => {
    assert.equal(deriveBuffetFormSeed([]), null);
  });

  it('maps persisted headcount from orders', () => {
    const orders = [orderWithBuffet(2, 1)];
    assert.deepEqual(deriveBuffetFormSeed(orders), {
      buffetId: buffetA.id,
      adults: 2,
      children: 1,
    });
  });

  it('builds stable seed keys for alignment', () => {
    assert.equal(buffetFormSeedKey({ buffetId: 'b1', adults: 2, children: 0 }), 'b1:2:0');
    assert.equal(buffetFormSeedKey(null), null);
  });
});

describe('resolveBuffetFormAlignState', () => {
  it('returns pending while detail is loading', () => {
    assert.deepEqual(
      resolveBuffetFormAlignState({ detailLoaded: false, orders: [], defaultBuffetId: 'b1' }),
      { mode: 'pending' },
    );
  });

  it('returns idle defaults when loaded with no buffet', () => {
    assert.deepEqual(
      resolveBuffetFormAlignState({ detailLoaded: true, orders: [], defaultBuffetId: 'b1' }),
      { mode: 'idle', defaultBuffetId: 'b1' },
    );
  });

  it('returns occupied seed from persisted orders', () => {
    const orders = [orderWithBuffet(2, 0)];
    assert.deepEqual(
      resolveBuffetFormAlignState({ detailLoaded: true, orders, defaultBuffetId: 'b1' }),
      {
        mode: 'occupied',
        seed: { buffetId: buffetA.id, adults: 2, children: 0 },
      },
    );
  });

  it('builds distinct align keys per table and session', () => {
    const occupied = resolveBuffetFormAlignState({
      detailLoaded: true,
      orders: [orderWithBuffet(2, 0)],
      defaultBuffetId: 'b1',
    });
    assert.notEqual(
      buffetFormAlignKey('t1', 's1', occupied),
      buffetFormAlignKey('t2', 's1', occupied),
    );
    assert.notEqual(
      buffetFormAlignKey('t1', 's1', occupied),
      buffetFormAlignKey('t1', 's2', occupied),
    );
  });
});

describe('formatBuffetGuestCountsOptional', () => {
  it('shows both segments when counts are positive', () => {
    assert.equal(formatBuffetGuestCountsOptional(2, 1, labels), '2大人 · 1小孩');
  });

  it('omits zero adult segment', () => {
    assert.equal(formatBuffetGuestCountsOptional(0, 3, labels), '3小孩');
  });

  it('omits zero child segment', () => {
    assert.equal(formatBuffetGuestCountsOptional(4, 0, labels), '4大人');
  });

  it('returns empty when both are zero', () => {
    assert.equal(formatBuffetGuestCountsOptional(0, 0, labels), '');
  });
});

describe('formatBuffetReceiptQtyLabel', () => {
  it('shows adult and child with hyphen', () => {
    assert.equal(formatBuffetReceiptQtyLabel(4, 2), 'A4-C2');
  });

  it('omits adult segment when zero', () => {
    assert.equal(formatBuffetReceiptQtyLabel(0, 3), 'C3');
  });

  it('omits child segment when zero', () => {
    assert.equal(formatBuffetReceiptQtyLabel(9, 0), 'A9');
  });

  it('returns empty when both are zero', () => {
    assert.equal(formatBuffetReceiptQtyLabel(0, 0), '');
  });
});

describe('formatBuffetPriceTemplate', () => {
  it('interpolates per-person rates', () => {
    const line = formatBuffetPriceTemplate('成人 €{adultPrice}/人 · 儿童 €{childPrice}/人', {
      adultPrice: 14.5,
      childPrice: 8.5,
    });
    assert.equal(line, '成人 €14.50/人 · 儿童 €8.50/人');
  });

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

  it('returns not ok when prices are missing', () => {
    assert.deepEqual(resolveBuffetOpenPricePreview(null, 2, 0), { ok: false });
    assert.deepEqual(
      resolveBuffetOpenPricePreview({ ...resolved, adult_price: null }, 2, 0),
      { ok: false },
    );
  });
});
