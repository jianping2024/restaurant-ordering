import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mayForceCloseTable,
  mayForceCloseTableForManualActor,
} from './force-close-table-policy';
import { capabilitiesFromKeys } from '@/lib/permissions/can';

describe('mayForceCloseTable', () => {
  it('allows owner star and force_close capability', () => {
    assert.equal(mayForceCloseTable('*'), true);
    assert.equal(mayForceCloseTable(capabilitiesFromKeys(['tables.force_close'])), true);
    assert.equal(mayForceCloseTable(capabilitiesFromKeys(['tables.checkout_close'])), false);
  });
});

describe('mayForceCloseTableForManualActor', () => {
  it('allows owner and frontdesk closed reasons only', () => {
    assert.equal(mayForceCloseTableForManualActor('owner_closed'), true);
    assert.equal(mayForceCloseTableForManualActor('frontdesk_closed'), true);
    assert.equal(mayForceCloseTableForManualActor('cashier_closed'), false);
  });
});
