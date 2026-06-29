import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCustomerGeoForOrder } from './customer-geo-order';

describe('resolveCustomerGeoForOrder', () => {
  it('skips geo when restriction is off', async () => {
    const result = await resolveCustomerGeoForOrder({
      restaurant: {
        geo_latitude: 39.1,
        geo_longitude: -9.2,
        feature_flags: { geo_order_restriction: false },
        order_radius_meters: 100,
      },
      isWaiterFlow: false,
      isLocalDevHost: false,
    });
    assert.deepEqual(result, { ok: true });
  });

  it('skips geo for waiter flow', async () => {
    const result = await resolveCustomerGeoForOrder({
      restaurant: {
        geo_latitude: 39.1,
        geo_longitude: -9.2,
        feature_flags: {},
        order_radius_meters: 100,
      },
      isWaiterFlow: true,
      isLocalDevHost: false,
    });
    assert.deepEqual(result, { ok: true });
  });
});
