import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mayForceCloseTableAsManualActor,
  mayForceCloseTableFromDashboardMode,
  mayForceCloseTableFromFloorRole,
} from '@/lib/table-session/force-close-table-policy';

describe('force-close-table-policy', () => {
  it('allows force close for owner and frontdesk dashboard modes only', () => {
    assert.equal(mayForceCloseTableFromDashboardMode('owner'), true);
    assert.equal(mayForceCloseTableFromDashboardMode('frontdesk'), true);
    assert.equal(mayForceCloseTableFromDashboardMode('cashier'), false);
    assert.equal(mayForceCloseTableFromDashboardMode('waiter'), false);
  });

  it('allows force close on floor board for frontdesk only', () => {
    assert.equal(mayForceCloseTableFromFloorRole('frontdesk'), true);
    assert.equal(mayForceCloseTableFromFloorRole('cashier'), false);
    assert.equal(mayForceCloseTableFromFloorRole('waiter'), false);
  });

  it('blocks cashier actor on manual force-close path', () => {
    assert.equal(mayForceCloseTableAsManualActor('owner_closed'), true);
    assert.equal(mayForceCloseTableAsManualActor('frontdesk_closed'), true);
    assert.equal(mayForceCloseTableAsManualActor('cashier_closed'), false);
  });
});
