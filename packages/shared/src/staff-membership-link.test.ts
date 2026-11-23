import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  linkPlanReady,
  linkStaffMembershipErrorCode,
  planStaffMembershipLinks,
} from './staff-membership-link';
import { restaurantCityFromAddress } from './restaurant-city';

const manager = { id: 'r-a-mgr', name: '店长', preset_key: null };
const cashier = { id: 'r-b-cash', name: '收银员', preset_key: 'cashier' };

describe('planStaffMembershipLinks', () => {
  const stores = [
    { restaurantId: 'A', roles: [manager], linked: false },
    { restaurantId: 'B', roles: [cashier], linked: false },
    { restaurantId: 'C', roles: [{ ...manager, id: 'r-c-mgr', name: ' 店长 ' }], linked: true },
  ];

  it('matches by name, lists missing, keeps already linked out', () => {
    const rows = planStaffMembershipLinks({ roleName: '店长', stores });
    assert.deepEqual(rows, [
      { restaurantId: 'A', status: 'matched', roleId: 'r-a-mgr' },
      { restaurantId: 'B', status: 'missing' },
      { restaurantId: 'C', status: 'already_linked' },
    ]);
    assert.equal(linkPlanReady(rows), false);
  });

  it('missing store resolved by per-store choice or skip', () => {
    const chosen = planStaffMembershipLinks({
      roleName: '店长',
      stores,
      overrides: { B: { roleId: 'r-b-cash' } },
    });
    assert.deepEqual(chosen[1], { restaurantId: 'B', status: 'chosen', roleId: 'r-b-cash' });
    assert.equal(linkPlanReady(chosen), true);

    const skipped = planStaffMembershipLinks({ roleName: '店长', stores, overrides: { B: 'skip' } });
    assert.deepEqual(skipped[1], { restaurantId: 'B', status: 'skipped' });
    assert.equal(linkPlanReady(skipped), true);
  });

  it('a choice naming another store role stays missing', () => {
    const rows = planStaffMembershipLinks({
      roleName: '店长',
      stores,
      overrides: { B: { roleId: 'r-a-mgr' } },
    });
    assert.equal(rows[1].status, 'missing');
  });

  it('nothing to link is not ready', () => {
    const rows = planStaffMembershipLinks({ roleName: '店长', stores: [stores[1]], overrides: { B: 'skip' } });
    assert.equal(linkPlanReady(rows), false);
  });
});

describe('linkStaffMembershipErrorCode', () => {
  it('maps DB trigger rejections', () => {
    assert.equal(linkStaffMembershipErrorCode({ code: '23505', message: 'dup' }), 'already_linked');
    assert.equal(
      linkStaffMembershipErrorCode({ code: '23514', message: 'staff_user_is_restaurant_owner' }),
      'owner_account',
    );
    assert.equal(
      linkStaffMembershipErrorCode({ code: '23514', message: 'print_agent_single_membership' }),
      'print_agent_account',
    );
    assert.equal(linkStaffMembershipErrorCode({ message: 'boom' }), 'insert_failed');
  });
});

describe('restaurantCityFromAddress', () => {
  it('last non-country segment without postal code', () => {
    assert.equal(restaurantCityFromAddress('Rua Augusta 100, 1100-053 Lisboa'), 'Lisboa');
    assert.equal(restaurantCityFromAddress('Rua X, 4000-001 Porto, Portugal'), 'Porto');
    assert.equal(restaurantCityFromAddress(null), '');
  });
});
