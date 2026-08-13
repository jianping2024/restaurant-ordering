import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUSHI_ROUND_MESSAGES,
  messageForSushiRoundError,
} from './sushi-round-messages';

describe('messageForSushiRoundError', () => {
  const zh = SUSHI_ROUND_MESSAGES.zh;

  it('maps guest_count_required to staff headcount copy', () => {
    assert.equal(
      messageForSushiRoundError('guest_count_required', zh),
      '请先让服务员登记用餐人数',
    );
  });

  it('interpolates used/cap for round_cap_exceeded', () => {
    const msg = messageForSushiRoundError('round_cap_exceeded', zh, {
      used: 16,
      cap: 16,
    });
    assert.match(msg, /16\/16/);
    assert.match(msg, /本轮核单/);
    assert.doesNotMatch(msg, /\{used\}|\{cap\}/);
  });
});
