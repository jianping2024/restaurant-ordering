import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterMenuItemsForOrderingChannel,
  menuItemUnitPriceForChannel,
  resolveTableOrderingChannel,
  salesChannelsFromTakeawayRole,
  takeawayRoleFromSalesChannels,
  takeawayRoleNeedsTakeawayPrice,
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

describe('sales channel ↔ role mapping', () => {
  it('maps four roles to chips and back', () => {
    assert.deepEqual(salesChannelsFromTakeawayRole('none'), {
      dineIn: true,
      takeaway: false,
      packaging: false,
    });
    assert.deepEqual(salesChannelsFromTakeawayRole('sellable'), {
      dineIn: true,
      takeaway: true,
      packaging: false,
    });
    assert.deepEqual(salesChannelsFromTakeawayRole('takeaway_only'), {
      dineIn: false,
      takeaway: true,
      packaging: false,
    });
    assert.deepEqual(salesChannelsFromTakeawayRole('packaging'), {
      dineIn: false,
      takeaway: false,
      packaging: true,
    });

    assert.equal(
      takeawayRoleFromSalesChannels({ dineIn: true, takeaway: false, packaging: false }),
      'none',
    );
    assert.equal(
      takeawayRoleFromSalesChannels({ dineIn: true, takeaway: true, packaging: false }),
      'sellable',
    );
    assert.equal(
      takeawayRoleFromSalesChannels({ dineIn: false, takeaway: true, packaging: false }),
      'takeaway_only',
    );
    assert.equal(
      takeawayRoleFromSalesChannels({ dineIn: false, takeaway: false, packaging: true }),
      'packaging',
    );
    assert.equal(
      takeawayRoleFromSalesChannels({ dineIn: false, takeaway: false, packaging: false }),
      'none',
    );
  });

  it('requires takeaway price for takeaway menu roles', () => {
    assert.equal(takeawayRoleNeedsTakeawayPrice('none'), false);
    assert.equal(takeawayRoleNeedsTakeawayPrice('packaging'), false);
    assert.equal(takeawayRoleNeedsTakeawayPrice('sellable'), true);
    assert.equal(takeawayRoleNeedsTakeawayPrice('takeaway_only'), true);
  });
});

describe('menu filter + price', () => {
  const dine = { id: 'dine', takeaway_role: 'none' as const, price: 10, takeaway_price: null };
  const sell = { id: 'sell', takeaway_role: 'sellable' as const, price: 12, takeaway_price: 11 };
  const only = { id: 'only', takeaway_role: 'takeaway_only' as const, price: 9, takeaway_price: 8 };
  const pack = { id: 'pack', takeaway_role: 'packaging' as const, price: 0.5, takeaway_price: null };
  const free = { id: 'free', takeaway_role: 'sellable' as const, price: 0, takeaway_price: 6 };
  const LUNCH = 'buffet-lunch';
  const DINNER = 'buffet-dinner';
  const buffetPrices = {
    dine: { [LUNCH]: 1.5 },
    sell: { [LUNCH]: 0, [DINNER]: 3 },
    free: { [DINNER]: 2 },
  };
  const price = (
    item: typeof dine | typeof sell | typeof only | typeof free,
    channel: 'dine_in' | 'takeaway',
    buffetId: string | null = null,
  ) => menuItemUnitPriceForChannel({ item, channel, buffetId, buffetPrices });

  it('dine-in hides packaging + takeaway_only; takeaway keeps sellable + takeaway_only', () => {
    assert.deepEqual(
      filterMenuItemsForOrderingChannel([dine, sell, only, pack], 'dine_in').map(
        (i) => i.takeaway_role,
      ),
      ['none', 'sellable'],
    );
    assert.deepEqual(
      filterMenuItemsForOrderingChannel([dine, sell, only, pack], 'takeaway').map(
        (i) => i.takeaway_role,
      ),
      ['sellable', 'takeaway_only'],
    );
  });

  it('takeaway uses takeaway_price for sellable and takeaway_only', () => {
    assert.equal(price(sell, 'takeaway'), 11);
    assert.equal(price(sell, 'dine_in'), 12);
    assert.equal(price(only, 'takeaway'), 8);
    assert.equal(price(only, 'dine_in'), 9);
  });

  it('takeaway never reads buffet config', () => {
    assert.equal(price(sell, 'takeaway', LUNCH), 11);
    assert.equal(price(dine, 'takeaway', LUNCH), 10);
  });

  it('dine-in without config (or without a buffet) uses the original price', () => {
    assert.equal(price(dine, 'dine_in', DINNER), 10);
    assert.equal(price(dine, 'dine_in', null), 10);
    assert.equal(price(only, 'dine_in', LUNCH), 9);
  });

  it('dine-in with config uses the current buffet price', () => {
    assert.equal(price(dine, 'dine_in', LUNCH), 1.5);
    assert.equal(price(sell, 'dine_in', DINNER), 3);
  });

  it('configured 0 makes the dish free for that buffet', () => {
    assert.equal(price(sell, 'dine_in', LUNCH), 0);
  });

  it('original 0 but configured > 0 charges the configured price', () => {
    assert.equal(price(free, 'dine_in', DINNER), 2);
    assert.equal(price(free, 'dine_in', LUNCH), 0);
  });
});
