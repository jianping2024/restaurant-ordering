import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterMenuItemsForOrderingChannel,
  menuItemUnitPriceForChannel,
  resolveTableOrderingChannel,
} from '@/lib/instore-takeaway';

describe('resolveTableOrderingChannel', () => {
  it('uses session stamp over group', () => {
    assert.equal(
      resolveTableOrderingChannel({
        takeawayOrderingEnabled: true,
        tableInTakeawayGroup: true,
        sessionChannel: 'dine_in',
      }),
      'dine_in',
    );
    assert.equal(
      resolveTableOrderingChannel({
        takeawayOrderingEnabled: false,
        tableInTakeawayGroup: false,
        sessionChannel: 'takeaway',
      }),
      'takeaway',
    );
  });

  it('flag off → dine_in when no session', () => {
    assert.equal(
      resolveTableOrderingChannel({
        takeawayOrderingEnabled: false,
        tableInTakeawayGroup: true,
      }),
      'dine_in',
    );
  });

  it('flag on + takeaway group → takeaway when no session', () => {
    assert.equal(
      resolveTableOrderingChannel({
        takeawayOrderingEnabled: true,
        tableInTakeawayGroup: true,
      }),
      'takeaway',
    );
  });
});

describe('menu filter + price', () => {
  const dine = { takeaway_role: 'none' as const, price: 10, takeaway_price: null };
  const sell = { takeaway_role: 'sellable' as const, price: 12, takeaway_price: 11 };
  const pack = { takeaway_role: 'packaging' as const, price: 0.5, takeaway_price: null };

  it('hides packaging on both channels; takeaway only sellable', () => {
    assert.deepEqual(
      filterMenuItemsForOrderingChannel([dine, sell, pack], 'dine_in').map((i) => i.takeaway_role),
      ['none', 'sellable'],
    );
    assert.deepEqual(
      filterMenuItemsForOrderingChannel([dine, sell, pack], 'takeaway').map((i) => i.takeaway_role),
      ['sellable'],
    );
  });

  it('takeaway uses takeaway_price', () => {
    assert.equal(menuItemUnitPriceForChannel(sell, 'takeaway'), 11);
    assert.equal(menuItemUnitPriceForChannel(sell, 'dine_in'), 12);
  });
});
