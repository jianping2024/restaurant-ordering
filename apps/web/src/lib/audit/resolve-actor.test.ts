import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveStaffOperatorDisplayName } from '@/lib/audit/resolve-actor';

describe('resolveStaffOperatorDisplayName', () => {
  it('prefers login_name over display_name', () => {
    assert.equal(
      resolveStaffOperatorDisplayName({
        login_name: 'qiantai1',
        display_name: '前台',
      }),
      'qiantai1',
    );
  });

  it('uses display_name when login_name empty', () => {
    assert.equal(
      resolveStaffOperatorDisplayName({
        login_name: '  ',
        display_name: 'Kitchen UAT',
      }),
      'Kitchen UAT',
    );
  });

  it('does not fall back to a role-like blank — empty string', () => {
    assert.equal(
      resolveStaffOperatorDisplayName({
        login_name: null,
        display_name: null,
      }),
      '',
    );
  });
});
