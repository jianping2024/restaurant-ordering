import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
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
