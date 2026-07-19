import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWaiterStandaloneTopNav,
  waiterStandaloneLogoHref,
} from './waiter-top-nav';
import { isStaffPersonalNavItemActive } from './staff-personal-top-nav';

describe('waiterStandaloneTopNav', () => {
  it('points logo and nav at dashboard waiter board', () => {
    const items = buildWaiterStandaloneTopNav('cafe-lisboa');
    assert.equal(items[0]?.href, '/dashboard/waiter');
    assert.equal(items[0]?.matchPrefix, '/dashboard/waiter');
    assert.equal(waiterStandaloneLogoHref('cafe-lisboa'), '/dashboard/waiter');
  });

  it('marks dashboard waiter paths active', () => {
    const item = buildWaiterStandaloneTopNav('cafe-lisboa')[0]!;
    assert.equal(isStaffPersonalNavItemActive('/dashboard/waiter', item), true);
    assert.equal(
      isStaffPersonalNavItemActive('/dashboard/waiter/table-uuid', item),
      true,
    );
    assert.equal(isStaffPersonalNavItemActive('/cafe-lisboa/kitchen', item), false);
  });
});
