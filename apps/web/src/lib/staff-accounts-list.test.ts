import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterStaffByLoginName,
  isStaffPageSize,
  STAFF_DEFAULT_PAGE_SIZE,
  STAFF_PAGE_SIZES,
} from './staff-accounts-list';
import type { RestaurantStaffAccount } from '../types';

function row(login_name: string, id = login_name): RestaurantStaffAccount {
  return {
    id,
    restaurant_id: 'r1',
    user_id: `u-${id}`,
    role: 'waiter',
    display_name: login_name,
    login_name,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    disabled_at: null,
  };
}

const staff = [row('qiantai'), row('nishesh'), row('waiter01'), row('Cashier_A')];

describe('filterStaffByLoginName', () => {
  it('matches login_name substring case-insensitively', () => {
    assert.deepEqual(
      filterStaffByLoginName(staff, 'QIAn').map((r) => r.login_name),
      ['qiantai'],
    );
  });

  it('returns all when search is empty/whitespace', () => {
    assert.equal(filterStaffByLoginName(staff, '  ').length, staff.length);
  });

  it('returns empty when nothing matches', () => {
    assert.deepEqual(filterStaffByLoginName(staff, 'zzz'), []);
  });
});

describe('staff page sizes', () => {
  it('exposes 10 and 20 only, default 10', () => {
    assert.deepEqual([...STAFF_PAGE_SIZES], [10, 20]);
    assert.equal(STAFF_DEFAULT_PAGE_SIZE, 10);
    assert.equal(isStaffPageSize(10), true);
    assert.equal(isStaffPageSize(20), true);
    assert.equal(isStaffPageSize(15), false);
  });
});
