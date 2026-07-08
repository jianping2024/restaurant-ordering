import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampOrderCooldownSeconds,
  formatSubmitCooldownWaitMessage,
} from './order-submit-cooldown-client';

describe('order-submit-cooldown-client', () => {
  it('clampOrderCooldownSeconds enforces 5–60', () => {
    assert.equal(clampOrderCooldownSeconds(undefined), 5);
    assert.equal(clampOrderCooldownSeconds(3), 5);
    assert.equal(clampOrderCooldownSeconds(5), 5);
    assert.equal(clampOrderCooldownSeconds(30), 30);
    assert.equal(clampOrderCooldownSeconds(100), 60);
  });

  it('formatSubmitCooldownWaitMessage substitutes seconds', () => {
    assert.equal(
      formatSubmitCooldownWaitMessage('Wait {seconds}s', 4),
      'Wait 4s',
    );
  });
});
