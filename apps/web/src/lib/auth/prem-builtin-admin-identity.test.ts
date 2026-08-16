import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREM_BUILTIN_ADMIN_EMAIL,
  PREM_BUILTIN_ADMIN_LOGIN_NAME,
  isPremBuiltinAdminActor,
  isPremBuiltinAdminEmail,
  isPremBuiltinAdminLoginName,
} from './prem-builtin-admin-identity';

describe('prem-builtin-admin-identity', () => {
  it('recognizes bare admin login name', () => {
    assert.equal(isPremBuiltinAdminLoginName('admin'), true);
    assert.equal(isPremBuiltinAdminLoginName('Admin'), true);
    assert.equal(isPremBuiltinAdminLoginName('admin@mesa.prem'), false);
    assert.equal(isPremBuiltinAdminLoginName('admin01'), false);
  });

  it('recognizes fixed Auth email', () => {
    assert.equal(isPremBuiltinAdminEmail(PREM_BUILTIN_ADMIN_EMAIL), true);
    assert.equal(isPremBuiltinAdminEmail('admin@mesa.in'), false);
  });

  it('actor check uses email or metadata', () => {
    assert.equal(
      isPremBuiltinAdminActor({ email: PREM_BUILTIN_ADMIN_EMAIL }),
      true,
    );
    assert.equal(
      isPremBuiltinAdminActor({
        userMetadata: { account_type: 'prem_builtin_admin' },
      }),
      true,
    );
    assert.equal(isPremBuiltinAdminActor({ email: 'owner@x.com' }), false);
  });

  it('exports stable login name', () => {
    assert.equal(PREM_BUILTIN_ADMIN_LOGIN_NAME, 'admin');
  });
});
