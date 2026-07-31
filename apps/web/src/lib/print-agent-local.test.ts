import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPrintAgentConfigureUrl,
  printAgentLocalHealthUrl,
  PRINT_AGENT_CONFIGURE_PORT,
} from './print-agent-local.ts';

describe('print-agent-local', () => {
  it('uses only configure port 17892 for dashboard deep links', () => {
    assert.equal(PRINT_AGENT_CONFIGURE_PORT, 17892);
    assert.equal(printAgentLocalHealthUrl(), 'http://127.0.0.1:17892/api/health');
    const withCode = buildPrintAgentConfigureUrl('http://192.168.0.141', '123456', 'zh');
    assert.equal(
      withCode,
      'http://127.0.0.1:17892/pair?api=http%3A%2F%2F192.168.0.141&code=123456&lang=zh',
    );
    const configure = buildPrintAgentConfigureUrl('https://app.example.com');
    assert.equal(
      configure,
      'http://127.0.0.1:17892/configure?api=https%3A%2F%2Fapp.example.com',
    );
    assert.ok(!withCode.includes('17890'));
    assert.ok(!configure.includes('17890'));
  });
});
