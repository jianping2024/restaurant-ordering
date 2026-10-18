import assert from 'node:assert/strict';
import { test } from 'node:test';

import { agentVersionOlderThan } from './print-agent-version-compare.ts';

test('agentVersionOlderThan: fiscal 0.5.x is not behind print-agent 0.3.x', () => {
  assert.equal(agentVersionOlderThan('0.5.32', '0.3.83'), false);
  assert.equal(agentVersionOlderThan('0.3.83', '0.5.32'), true);
});

test('agentVersionOlderThan: equal and newer', () => {
  assert.equal(agentVersionOlderThan('0.5.35', '0.5.35'), false);
  assert.equal(agentVersionOlderThan('0.5.36', '0.5.35'), false);
  assert.equal(agentVersionOlderThan('0.5.34', '0.5.35'), true);
});

test('agentVersionOlderThan: v prefix', () => {
  assert.equal(agentVersionOlderThan('v0.5.32', '0.5.35'), true);
});
