import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStaffAuthEmail,
  resolveAuthIdentifier,
  staffLoginNameFromAuthEmail,
} from './resolve-auth-identifier';

describe('resolveAuthIdentifier', () => {
  it('treats owner emails as owner_email', () => {
    const result = resolveAuthIdentifier('owner@gmail.com');
    assert.ok(result);
    assert.equal(result.kind, 'owner_email');
    assert.equal(result.email, 'owner@gmail.com');
    assert.equal(result.loginName, null);
  });

  it('treats bare login name as staff', () => {
    const result = resolveAuthIdentifier('kitchen01');
    assert.ok(result);
    assert.equal(result.kind, 'staff');
    assert.equal(result.loginName, 'kitchen01');
    assert.equal(result.email, 'kitchen01@mesa.in');
  });

  it('treats legacy staff email paste as staff', () => {
    const result = resolveAuthIdentifier('kitchen01@mesa.in');
    assert.ok(result);
    assert.equal(result.kind, 'staff');
    assert.equal(result.loginName, 'kitchen01');
  });

  it('rejects invalid bare login names', () => {
    assert.equal(resolveAuthIdentifier('ab'), null);
    assert.equal(resolveAuthIdentifier(''), null);
  });

  it('rejects reserved admin when not on prem', () => {
    const prev = process.env.MESA_ON_PREM;
    delete process.env.MESA_ON_PREM;
    try {
      assert.equal(resolveAuthIdentifier('admin'), null);
    } finally {
      if (prev === undefined) delete process.env.MESA_ON_PREM;
      else process.env.MESA_ON_PREM = prev;
    }
  });

  it('maps admin to prem built-in email when on prem', () => {
    const prev = process.env.MESA_ON_PREM;
    process.env.MESA_ON_PREM = '1';
    try {
      const result = resolveAuthIdentifier('admin');
      assert.ok(result);
      assert.equal(result.kind, 'prem_builtin_admin');
      assert.equal(result.email, 'admin@mesa.prem');
      assert.equal(result.loginName, null);
    } finally {
      if (prev === undefined) delete process.env.MESA_ON_PREM;
      else process.env.MESA_ON_PREM = prev;
    }
  });
});

describe('staffLoginNameFromAuthEmail', () => {
  it('parses valid staff auth emails', () => {
    assert.equal(staffLoginNameFromAuthEmail('waiter01@mesa.in'), 'waiter01');
  });

  it('returns null for non-staff domains', () => {
    assert.equal(staffLoginNameFromAuthEmail('waiter@gmail.com'), null);
  });
});

describe('isStaffAuthEmail', () => {
  it('detects internal staff domain', () => {
    assert.equal(isStaffAuthEmail('x@mesa.in'), true);
    assert.equal(isStaffAuthEmail('x@gmail.com'), false);
  });
});
