import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPrintAgentStaffRole,
  printAgentLoginName,
  printAgentStaffEmail,
  PRINT_AGENT_STAFF_ROLE,
} from './print-agent-staff';

describe('print-agent-staff', () => {
  it('builds stable login and email from restaurant id', () => {
    const id = '01234567-89ab-cdef-0123-456789abcdef';
    assert.equal(printAgentLoginName(id), 'pa0123456789abcdef0123456789abcdef'.slice(0, 32));
    assert.equal(printAgentLoginName(id).length, 32);
    assert.equal(printAgentStaffEmail(id), `${printAgentLoginName(id)}@mesa.in`);
  });

  it('recognizes print_agent role only', () => {
    assert.equal(isPrintAgentStaffRole(PRINT_AGENT_STAFF_ROLE), true);
    assert.equal(isPrintAgentStaffRole('kitchen'), false);
  });
});
