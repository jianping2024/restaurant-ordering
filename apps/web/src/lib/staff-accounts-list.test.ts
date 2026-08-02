import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterStaffByLoginName,
  sortStaffAccounts,
} from './staff-accounts-list';
import type { RestaurantStaffAccount } from '../types';

function row(
  login_name: string,
  id = login_name,
  created_at = '2026-01-01T00:00:00Z',
): RestaurantStaffAccount {
  return {
    id,
    restaurant_id: 'r1',
    user_id: `u-${id}`,
    role: 'waiter',
    display_name: login_name,
    login_name,
    created_at,
    updated_at: created_at,
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

describe('sortStaffAccounts', () => {
  const rows = [
    row('zeta', '1', '2026-01-03T00:00:00Z'),
    row('alpha', '2', '2026-01-01T00:00:00Z'),
    row('beta', '3', '2026-01-02T00:00:00Z'),
  ];

  it('sorts by login_name', () => {
    assert.deepEqual(
      sortStaffAccounts(rows, 'login_name', 'asc').map((r) => r.login_name),
      ['alpha', 'beta', 'zeta'],
    );
  });

  it('sorts by created_at desc', () => {
    assert.deepEqual(
      sortStaffAccounts(rows, 'created_at', 'desc').map((r) => r.login_name),
      ['zeta', 'beta', 'alpha'],
    );
  });
});
