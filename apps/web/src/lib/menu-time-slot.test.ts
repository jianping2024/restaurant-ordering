import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isMenuItemServedInTimeSlot,
  resolveMenuTimeSlotId,
  resolveSessionMenuTimeSlotId,
  type MenuTimeSlot,
} from './menu-time-slot';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const lunch: MenuTimeSlot = {
  id: 'lunch',
  name: '午市',
  start_time: '12:00:00',
  end_time: '15:00:00',
  weekdays: ALL_DAYS,
  sort_order: 0,
};
const dinner: MenuTimeSlot = {
  id: 'dinner',
  name: '夜市',
  start_time: '19:00:00',
  end_time: '23:00:00',
  weekdays: ALL_DAYS,
  sort_order: 1,
};
const slots = [lunch, dinner];

/** 2026-10-20 is a Tuesday; Lisbon is UTC+1 (WEST) that day. */
function lisbon(hhmm: string, date = '2026-10-20'): Date {
  return new Date(`${date}T${hhmm}:00+01:00`);
}

describe('resolveMenuTimeSlotId', () => {
  it('inside a slot → that slot', () => {
    assert.equal(resolveMenuTimeSlotId(slots, lisbon('13:00')), 'lunch');
    assert.equal(resolveMenuTimeSlotId(slots, lisbon('20:00')), 'dinner');
  });

  it('overtime after lunch stays lunch until the midpoint', () => {
    assert.equal(resolveMenuTimeSlotId(slots, lisbon('16:30')), 'lunch');
    assert.equal(resolveMenuTimeSlotId(slots, lisbon('16:59')), 'lunch');
  });

  it('early dinner opening picks dinner', () => {
    assert.equal(resolveMenuTimeSlotId(slots, lisbon('18:30')), 'dinner');
    assert.equal(resolveMenuTimeSlotId(slots, lisbon('17:01')), 'dinner');
  });

  it('exact midpoint tie → lower sort_order', () => {
    assert.equal(resolveMenuTimeSlotId(slots, lisbon('17:00')), 'lunch');
  });

  it('before the first slot and after the last', () => {
    assert.equal(resolveMenuTimeSlotId(slots, lisbon('11:30')), 'lunch');
    assert.equal(resolveMenuTimeSlotId(slots, lisbon('23:40')), 'dinner');
  });

  it('weekday filter skips slots not running that day', () => {
    const weekdayLunch = { ...lunch, weekdays: [1, 2, 3, 4, 5] };
    // 2026-10-25 is a Sunday (Lisbon back on UTC+0 after DST end).
    const sundayNoon = new Date('2026-10-25T12:30:00+00:00');
    assert.equal(resolveMenuTimeSlotId([weekdayLunch, dinner], sundayNoon), 'dinner');
    assert.equal(resolveMenuTimeSlotId([weekdayLunch], sundayNoon), null);
  });

  it('overnight slot covers past midnight', () => {
    const late = { ...dinner, id: 'late', start_time: '22:00:00', end_time: '02:00:00' };
    assert.equal(resolveMenuTimeSlotId([lunch, late], lisbon('01:00')), 'late');
  });

  it('no slots → null', () => {
    assert.equal(resolveMenuTimeSlotId([], lisbon('13:00')), null);
  });
});

describe('resolveSessionMenuTimeSlotId', () => {
  it('session opened at lunch keeps lunch even when now is dinner time', () => {
    const openedAt = lisbon('14:50').toISOString();
    assert.equal(resolveSessionMenuTimeSlotId(slots, openedAt, lisbon('19:30')), 'lunch');
  });

  it('no session → now', () => {
    assert.equal(resolveSessionMenuTimeSlotId(slots, null, lisbon('18:40')), 'dinner');
  });
});

describe('isMenuItemServedInTimeSlot', () => {
  it('all-day dish always served; slot dish only in its slot', () => {
    assert.equal(isMenuItemServedInTimeSlot({ time_slot_id: null }, 'dinner'), true);
    assert.equal(isMenuItemServedInTimeSlot({ time_slot_id: null }, null), true);
    assert.equal(isMenuItemServedInTimeSlot({ time_slot_id: 'lunch' }, 'lunch'), true);
    assert.equal(isMenuItemServedInTimeSlot({ time_slot_id: 'lunch' }, 'dinner'), false);
    assert.equal(isMenuItemServedInTimeSlot({ time_slot_id: 'lunch' }, null), false);
  });
});
