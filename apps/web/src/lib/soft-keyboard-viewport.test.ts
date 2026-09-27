import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  scrollDeltaIntoVisualViewport,
  shouldCommitOnSoftKeyboardDismiss,
  softKeyboardOpen,
} from './soft-keyboard-viewport';

describe('softKeyboardOpen', () => {
  it('is true when the visual viewport is much shorter than the window', () => {
    assert.equal(softKeyboardOpen(800, 400), true);
  });

  it('is false when heights are close', () => {
    assert.equal(softKeyboardOpen(800, 780), false);
  });
});

describe('shouldCommitOnSoftKeyboardDismiss', () => {
  it('commits only on open → closed', () => {
    assert.equal(shouldCommitOnSoftKeyboardDismiss(true, false), true);
    assert.equal(shouldCommitOnSoftKeyboardDismiss(false, false), false);
    assert.equal(shouldCommitOnSoftKeyboardDismiss(true, true), false);
    assert.equal(shouldCommitOnSoftKeyboardDismiss(false, true), false);
  });
});

describe('scrollDeltaIntoVisualViewport', () => {
  it('scrolls down when the field sits below the target band', () => {
    const delta = scrollDeltaIntoVisualViewport({
      elementTop: 500,
      elementHeight: 40,
      viewportOffsetTop: 0,
      viewportHeight: 400,
      targetRatio: 0.35,
    });
    // desiredTop = 0 + 140 - 20 = 120; delta = 500 - 120 = 380
    assert.equal(delta, 380);
  });

  it('scrolls up when the field sits above the target band', () => {
    const delta = scrollDeltaIntoVisualViewport({
      elementTop: 20,
      elementHeight: 40,
      viewportOffsetTop: 0,
      viewportHeight: 400,
      targetRatio: 0.35,
    });
    assert.ok(delta < 0);
  });
});
