import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccessDashboardWaiterBoard, isDashboardNavDocked } from './dashboard-nav-config';

describe('isDashboardNavDocked', () => {
  it('docks owner nav on large screens when open', () => {
    assert.equal(isDashboardNavDocked('owner', true, true), true);
    assert.equal(isDashboardNavDocked('owner', true, false), false);
    assert.equal(isDashboardNavDocked('owner', false, true), false);
  });

  it('never docks operational roles', () => {
    assert.equal(isDashboardNavDocked('frontdesk', true, true), false);
    assert.equal(isDashboardNavDocked('cashier', true, true), false);
  });
});

describe('canAccessDashboardWaiterBoard', () => {
  it('allows frontdesk only among operational roles', () => {
    assert.equal(canAccessDashboardWaiterBoard('frontdesk'), true);
    assert.equal(canAccessDashboardWaiterBoard('cashier'), false);
    assert.equal(canAccessDashboardWaiterBoard('owner'), false);
  });
});
