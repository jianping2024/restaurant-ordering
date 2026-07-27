import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mayForceCloseTable,
  mayForceCloseTableForManualActor,
} from '@/lib/table-session/force-close-table-policy';

describe('force-close-table-policy', () => {
  it('allows force close for owner and frontdesk only', () => {
    assert.equal(mayForceCloseTable('owner'), true);
    assert.equal(mayForceCloseTable('frontdesk'), true);
    assert.equal(mayForceCloseTable('cashier'), false);
    assert.equal(mayForceCloseTable('waiter'), false);
  });

  it('blocks cashier manual actor via settled reason mapping', () => {
    assert.equal(mayForceCloseTableForManualActor('cashier_closed'), false);
    assert.equal(mayForceCloseTableForManualActor('frontdesk_closed'), true);
    assert.equal(mayForceCloseTableForManualActor('owner_closed'), true);
  });
});
