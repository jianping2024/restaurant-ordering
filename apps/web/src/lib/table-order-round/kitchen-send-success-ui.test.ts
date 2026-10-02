import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isKitchenSendSuccessStatusTransition,
  kitchenSendSuccessDedupeKey,
} from './kitchen-send-success-ui';

describe('isKitchenSendSuccessStatusTransition', () => {
  it('fires pending_confirm → cooldown', () => {
    assert.equal(isKitchenSendSuccessStatusTransition('pending_confirm', 'cooldown'), true);
  });

  it('fires finalize_failed → cooldown (retry succeeded)', () => {
    assert.equal(isKitchenSendSuccessStatusTransition('finalize_failed', 'cooldown'), true);
  });

  it('fires collecting → cooldown (missed pending snapshot)', () => {
    assert.equal(isKitchenSendSuccessStatusTransition('collecting', 'cooldown'), true);
  });

  it('does not fire on mount (prev null)', () => {
    assert.equal(isKitchenSendSuccessStatusTransition(null, 'cooldown'), false);
    assert.equal(isKitchenSendSuccessStatusTransition(undefined, 'cooldown'), false);
  });

  it('does not fire while staying on cooldown', () => {
    assert.equal(isKitchenSendSuccessStatusTransition('cooldown', 'cooldown'), false);
  });

  it('does not fire on finalize_failed alone', () => {
    assert.equal(isKitchenSendSuccessStatusTransition('pending_confirm', 'finalize_failed'), false);
    assert.equal(isKitchenSendSuccessStatusTransition('finalize_failed', 'finalize_failed'), false);
  });

  it('does not fire cooldown → collecting', () => {
    assert.equal(isKitchenSendSuccessStatusTransition('cooldown', 'collecting'), false);
  });
});

describe('kitchenSendSuccessDedupeKey', () => {
  it('returns trimmed round id', () => {
    assert.equal(kitchenSendSuccessDedupeKey('  abc  '), 'abc');
  });

  it('returns null for empty', () => {
    assert.equal(kitchenSendSuccessDedupeKey(''), null);
    assert.equal(kitchenSendSuccessDedupeKey(null), null);
    assert.equal(kitchenSendSuccessDedupeKey(undefined), null);
  });
});
