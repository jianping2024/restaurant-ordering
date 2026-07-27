import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeBuffetDashboardPatch } from './buffet-dashboard-patch';
import type { BuffetDashboardData } from './dashboard-buffet-server';

const base: BuffetDashboardData = {
  buffets: [{ id: 'b1', restaurant_id: 'r1', name: 'A', is_active: true, description: null, created_at: '', updated_at: '' }],
  slots: [{ id: 's1', restaurant_id: 'r1', name: 'Lunch', start_time: '11:00', end_time: '15:00', weekdays: [0], sort_order: 0, created_at: '' }],
  rules: [],
  calendarRows: [{ on_date: '2026-01-01', kind: 'holiday' }],
  buffet_friday_weekend_from: '18:00:00',
};

describe('mergeBuffetDashboardPatch', () => {
  it('merges only provided slices', () => {
    const next = mergeBuffetDashboardPatch(base, {
      buffets: [{ ...base.buffets[0], name: 'B' }],
    });
    assert.equal(next.buffets[0].name, 'B');
    assert.equal(next.slots[0].id, 's1');
    assert.equal(next.calendarRows.length, 1);
    assert.equal(next.buffet_friday_weekend_from, '18:00:00');
  });

  it('allows clearing friday policy with null', () => {
    const next = mergeBuffetDashboardPatch(base, { buffet_friday_weekend_from: null });
    assert.equal(next.buffet_friday_weekend_from, null);
  });
});
