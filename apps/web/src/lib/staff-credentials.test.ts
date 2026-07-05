import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStaffCredentials } from './staff-credentials';

describe('resolveStaffCredentials', () => {
  it('accepts a bare login name', () => {
    const result = resolveStaffCredentials('waiter01');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.loginName, 'waiter01');
      assert.equal(result.email, 'waiter01@mesa.in');
    }
  });

  it('strips pasted legacy staff email to login name', () => {
    const result = resolveStaffCredentials('waiter01@mesa.in');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.loginName, 'waiter01');
    }
  });

  it('rejects reserved login names', () => {
    assert.equal(resolveStaffCredentials('admin').ok, false);
  });

  it('rejects too-short names', () => {
    assert.equal(resolveStaffCredentials('ab').ok, false);
  });
});
