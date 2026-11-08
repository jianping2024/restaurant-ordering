import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  loadMenuItemBuffetPriceMap,
  parseMenuItemBuffetPricesBody,
} from '@/lib/menu-item-buffet-prices';

function mockAdmin(rows: Array<Record<string, unknown>>): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const B1 = 'a0000001-0000-4000-8000-000000000001';
const B2 = 'a0000002-0000-4000-8000-000000000002';

describe('loadMenuItemBuffetPriceMap', () => {
  it('maps dish → buffet → numeric price (numeric strings from PostgREST)', async () => {
    assert.deepEqual(
      await loadMenuItemBuffetPriceMap(
        mockAdmin([
          { menu_item_id: 'd1', buffet_id: B1, price: '0.00' },
          { menu_item_id: 'd1', buffet_id: B2, price: 2.5 },
          { menu_item_id: 'd2', buffet_id: B1, price: '1.50' },
        ]),
        'r1',
      ),
      { d1: { [B1]: 0, [B2]: 2.5 }, d2: { [B1]: 1.5 } },
    );
  });

  it('skips the query when a scoped read has no dishes', async () => {
    assert.deepEqual(
      await loadMenuItemBuffetPriceMap(mockAdmin([]), 'r1', { buffetId: B1, menuItemIds: [] }),
      {},
    );
  });
});

describe('parseMenuItemBuffetPricesBody', () => {
  it('accepts ≥ 0 prices (0 included) and rounds to cents', () => {
    assert.deepEqual(
      parseMenuItemBuffetPricesBody([
        { buffet_id: B1, price: 0 },
        { buffet_id: B2, price: 2.005 },
      ]),
      [
        { buffet_id: B1, price: 0 },
        { buffet_id: B2, price: 2.01 },
      ],
    );
    assert.deepEqual(parseMenuItemBuffetPricesBody([]), []);
  });

  it('rejects missing body, negative / non-number price, bad id, duplicates', () => {
    assert.equal(parseMenuItemBuffetPricesBody(undefined), null);
    assert.equal(parseMenuItemBuffetPricesBody([{ buffet_id: B1, price: -0.01 }]), null);
    assert.equal(parseMenuItemBuffetPricesBody([{ buffet_id: B1, price: '1' }]), null);
    assert.equal(parseMenuItemBuffetPricesBody([{ buffet_id: B1, price: Number.NaN }]), null);
    assert.equal(parseMenuItemBuffetPricesBody([{ buffet_id: 'x', price: 1 }]), null);
    assert.equal(
      parseMenuItemBuffetPricesBody([
        { buffet_id: B1, price: 1 },
        { buffet_id: B1, price: 2 },
      ]),
      null,
    );
  });
});
