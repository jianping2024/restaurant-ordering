import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isRestaurantOpenNow,
  normalizeRestaurantBusinessHours,
  restaurantOpenUntilLabel,
} from './restaurant-business-hours';

describe('restaurant-business-hours', () => {
  const hours = normalizeRestaurantBusinessHours({
    timezone: 'Europe/Lisbon',
    week: {
      '1': [
        { open: '12:00', close: '15:00' },
        { open: '18:00', close: '23:00' },
      ],
    },
  });

  it('normalizes week windows', () => {
    assert.equal(hours.week['1']?.length, 2);
    assert.equal(hours.week['1']?.[0]?.open, '12:00');
  });

  it('detects open inside a window (Lisbon Monday lunch)', () => {
    // 2026-10-12 is a Monday
    const noon = new Date('2026-10-12T11:30:00.000Z'); // 12:30 Lisbon (WEST/UTC+1 in Oct)
    assert.equal(isRestaurantOpenNow(hours, noon), true);
    assert.equal(restaurantOpenUntilLabel(hours, noon), '15:00');
  });

  it('detects closed between lunch and dinner', () => {
    const afternoon = new Date('2026-10-12T15:00:00.000Z'); // 16:00 Lisbon
    assert.equal(isRestaurantOpenNow(hours, afternoon), false);
    assert.equal(restaurantOpenUntilLabel(hours, afternoon), null);
  });
});
