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
  const dine = { takeaway_role: 'none' as const, price: 10, takeaway_price: null };
  const sell = { takeaway_role: 'sellable' as const, price: 12, takeaway_price: 11 };
  const only = { takeaway_role: 'takeaway_only' as const, price: 9, takeaway_price: 8 };
  const pack = { takeaway_role: 'packaging' as const, price: 0.5, takeaway_price: null };

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
    assert.equal(menuItemUnitPriceForChannel(sell, 'takeaway'), 11);
    assert.equal(menuItemUnitPriceForChannel(sell, 'dine_in'), 12);
    assert.equal(menuItemUnitPriceForChannel(only, 'takeaway'), 8);
    assert.equal(menuItemUnitPriceForChannel(only, 'dine_in'), 9);
  });
});
