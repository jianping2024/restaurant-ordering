import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { canAccessSystemLogs } from './access.ts';
import type { OwnerPrincipal, StaffPrincipal } from '../permissions/types.ts';

describe('canAccessSystemLogs', () => {
  const prev = process.env.MESA_ON_PREM;

  afterEach(() => {
    if (prev === undefined) delete process.env.MESA_ON_PREM;
    else process.env.MESA_ON_PREM = prev;
  });

  it('allows only on-prem backend admin (owner)', () => {
    process.env.MESA_ON_PREM = '1';
    const owner: OwnerPrincipal = {
      kind: 'owner',
      restaurantId: 'r1',
      userId: 'u1',
    };
    assert.equal(canAccessSystemLogs(owner), true);
  });

  it('denies staff even on-prem', () => {
    process.env.MESA_ON_PREM = '1';
    const staff: StaffPrincipal = {
      kind: 'staff',
      restaurantId: 'r1',
      userId: 'u2',
      staffAccountId: 's1',
      roleId: 'role1',
      roleName: '店主',
      presetKey: 'owner',
      staffRoleLabel: 'owner',
    };
    assert.equal(canAccessSystemLogs(staff), false);
  });

  it('denies owner when not on-prem', () => {
    delete process.env.MESA_ON_PREM;
    const owner: OwnerPrincipal = {
      kind: 'owner',
      restaurantId: 'r1',
      userId: 'u1',
    };
    assert.equal(canAccessSystemLogs(owner), false);
  });
});
