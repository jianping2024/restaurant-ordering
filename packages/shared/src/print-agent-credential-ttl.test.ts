import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PRINT_AGENT_CREDENTIAL_TTL_DAYS_DEFAULT,
  PRINT_AGENT_CREDENTIAL_TTL_DAYS_MAX,
  clampPrintAgentCredentialTtlDays,
  parsePrintAgentCredentialTtlDaysPatch,
  printAgentCredentialTtlSec,
  resolvePrintAgentCredentialTtlDays,
  resolvePrintAgentCredentialTtlSec,
} from './print-agent-credential-ttl';

describe('print-agent-credential-ttl', () => {
  it('defaults to 365 days', () => {
    assert.equal(PRINT_AGENT_CREDENTIAL_TTL_DAYS_DEFAULT, 365);
    assert.equal(resolvePrintAgentCredentialTtlDays(null), 365);
    assert.equal(resolvePrintAgentCredentialTtlDays({}), 365);
  });

  it('clamps configured days', () => {
    assert.equal(resolvePrintAgentCredentialTtlDays({ credential_ttl_days: 90 }), 90);
    assert.equal(clampPrintAgentCredentialTtlDays(500), PRINT_AGENT_CREDENTIAL_TTL_DAYS_MAX);
    assert.equal(clampPrintAgentCredentialTtlDays(0), 1);
  });

  it('converts days to seconds', () => {
    assert.equal(printAgentCredentialTtlSec(365), 365 * 24 * 60 * 60);
    assert.equal(resolvePrintAgentCredentialTtlSec({ credential_ttl_days: 90 }), 90 * 24 * 60 * 60);
  });

  it('parses patch body', () => {
    assert.equal(parsePrintAgentCredentialTtlDaysPatch({ credentialTtlDays: 120 }), 120);
    assert.equal(parsePrintAgentCredentialTtlDaysPatch({ flags: {} }), undefined);
    assert.equal(parsePrintAgentCredentialTtlDaysPatch({ credentialTtlDays: 'x' }), null);
  });
});
