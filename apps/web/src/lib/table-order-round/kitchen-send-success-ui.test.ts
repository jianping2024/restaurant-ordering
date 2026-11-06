import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isKitchenSendSuccessStatusTransition,
  kitchenSendSuccessDedupeKey,
} from './kitchen-send-success-ui';

const until = '2026-10-26T12:02:00.000Z';
const nowMs = Date.parse('2026-10-26T12:00:00.000Z');

describe('isKitchenSendSuccessStatusTransition', () => {
  it('fires pending_confirm → null with live session cooldown', () => {
    assert.equal(
      isKitchenSendSuccessStatusTransition({
        prev: 'pending_confirm',
        next: null,
        sessionCooldownUntil: until,
        nowMs,
      }),
      true,
    );
  });

  it('fires finalize_failed → collecting with live session cooldown', () => {
    assert.equal(
      isKitchenSendSuccessStatusTransition({
        prev: 'finalize_failed',
        next: 'collecting',
        sessionCooldownUntil: until,
        nowMs,
      }),
      true,
    );
  });

  it('fires legacy pending_confirm → cooldown', () => {
    assert.equal(
      isKitchenSendSuccessStatusTransition({
        prev: 'pending_confirm',
        next: 'cooldown',
        nowMs,
      }),
      true,
    );
  });

  it('does not fire empty-basket reset without session cooldown', () => {
    assert.equal(
      isKitchenSendSuccessStatusTransition({
        prev: 'pending_confirm',
        next: 'collecting',
        sessionCooldownUntil: null,
        nowMs,
      }),
      false,
    );
  });

  it('does not fire on mount (prev null)', () => {
    assert.equal(
      isKitchenSendSuccessStatusTransition({
        prev: null,
        next: null,
        sessionCooldownUntil: until,
        nowMs,
      }),
      false,
    );
  });

  it('does not fire while staying on cooldown', () => {
    assert.equal(
      isKitchenSendSuccessStatusTransition({
        prev: 'cooldown',
        next: 'cooldown',
        nowMs,
      }),
      false,
    );
  });
});

describe('kitchenSendSuccessDedupeKey', () => {
  it('returns trimmed session cooldown until', () => {
    assert.equal(kitchenSendSuccessDedupeKey(`  ${until}  `), until);
  });

  it('returns null for empty', () => {
    assert.equal(kitchenSendSuccessDedupeKey(''), null);
    assert.equal(kitchenSendSuccessDedupeKey(null), null);
    assert.equal(kitchenSendSuccessDedupeKey(undefined), null);
  });
});
