import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  forceClosePrincipalFromManualActorReason,
  mayForceCloseTable,
} from '@/lib/table-session/force-close-table-policy';

describe('force-close-table-policy', () => {
  it('allows force close for owner and frontdesk only', () => {
    assert.equal(mayForceCloseTable('owner'), true);
    assert.equal(mayForceCloseTable('frontdesk'), true);
    assert.equal(mayForceCloseTable('cashier'), false);
    assert.equal(mayForceCloseTable('waiter'), false);
  });

  it('maps manual actor reasons to floor principals', () => {
    assert.equal(forceClosePrincipalFromManualActorReason('owner_closed'), 'owner');
    assert.equal(forceClosePrincipalFromManualActorReason('frontdesk_closed'), 'frontdesk');
    assert.equal(forceClosePrincipalFromManualActorReason('cashier_closed'), 'cashier');
  });

  it('blocks cashier manual actor via principal mapping', () => {
    assert.equal(
      mayForceCloseTable(forceClosePrincipalFromManualActorReason('cashier_closed')),
      false,
    );
  });
});
