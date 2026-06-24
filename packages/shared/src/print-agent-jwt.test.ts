import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signPrintAgentJwt, verifyPrintAgentJwt } from './print-agent-jwt';
import {
  PRINT_AGENT_SUPPORT_TOKEN_TTL_SEC,
  signPrintAgentSupportJwt,
  verifyPrintAgentSupportJwt,
} from './print-agent-support-jwt';

describe('print-agent-jwt (shared)', () => {
  const secret = 'test-jwt-secret';

  it('signs and verifies agent jwt', () => {
    const token = signPrintAgentJwt({ restaurant_id: 'r1', device_id: 'd1' }, secret, 120);
    const claims = verifyPrintAgentJwt(token, secret);
    assert.equal(claims?.restaurant_id, 'r1');
    assert.equal(claims?.device_id, 'd1');
  });
});

describe('print-agent-support-jwt', () => {
  const secret = 'test-support-secret';

  it('signs and verifies support claims', () => {
    const token = signPrintAgentSupportJwt(
      {
        jti: '11111111-1111-1111-1111-111111111111',
        restaurant_id: 'r1',
        device_id: 'd1',
        actor_user_id: 'a1',
      },
      secret,
      120,
    );
    const claims = verifyPrintAgentSupportJwt(token, secret);
    assert.equal(claims?.jti, '11111111-1111-1111-1111-111111111111');
    assert.equal(claims?.typ, 'print_agent_support');
  });

  it('rejects wrong secret', () => {
    const token = signPrintAgentSupportJwt(
      { jti: 'j', restaurant_id: 'r', device_id: 'd', actor_user_id: 'a' },
      secret,
    );
    assert.equal(verifyPrintAgentSupportJwt(token, 'other'), null);
  });

  it('defaults TTL to 15 minutes', () => {
    assert.equal(PRINT_AGENT_SUPPORT_TOKEN_TTL_SEC, 900);
  });
});
