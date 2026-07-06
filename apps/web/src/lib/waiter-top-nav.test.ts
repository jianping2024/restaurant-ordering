import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isStaffPersonalNavItemActive } from './staff-personal-top-nav';
import {
  buildWaiterStandaloneTopNav,
  waiterStandaloneLogoHref,
} from './waiter-top-nav';

describe('waiter standalone top nav', () => {
  it('builds board nav with slug prefix match', () => {
    const items = buildWaiterStandaloneTopNav('cafe-lisboa');
    assert.equal(items.length, 1);
    assert.equal(items[0]?.href, '/cafe-lisboa/waiter');
    assert.equal(items[0]?.matchPrefix, '/cafe-lisboa/waiter');
    assert.equal(waiterStandaloneLogoHref('cafe-lisboa'), '/cafe-lisboa/waiter');
  });

  it('highlights board and table detail paths', () => {
    const [item] = buildWaiterStandaloneTopNav('cafe-lisboa');
    assert.ok(item);
    assert.equal(isStaffPersonalNavItemActive('/cafe-lisboa/waiter', item), true);
    assert.equal(
      isStaffPersonalNavItemActive('/cafe-lisboa/waiter/table-uuid', item),
      true,
    );
    assert.equal(isStaffPersonalNavItemActive('/cafe-lisboa/kitchen', item), false);
  });
});
