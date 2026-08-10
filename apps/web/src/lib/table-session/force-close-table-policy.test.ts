import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mayForceCloseTable } from './force-close-table-policy';
import { capabilitiesFromKeys } from '@/lib/permissions/can';

describe('mayForceCloseTable', () => {
  it('allows owner star and force_close capability', () => {
    assert.equal(mayForceCloseTable('*'), true);
    assert.equal(mayForceCloseTable(capabilitiesFromKeys(['tables.force_close'])), true);
    assert.equal(mayForceCloseTable(capabilitiesFromKeys(['tables.checkout_close'])), false);
  });
});
