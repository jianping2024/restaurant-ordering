import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fixedBarBottomAboveVisualViewport } from './soft-keyboard-viewport';

describe('fixedBarBottomAboveVisualViewport', () => {
  it('is zero when the visual viewport fills the window', () => {
    assert.equal(fixedBarBottomAboveVisualViewport(800, 0, 800), 0);
  });

  it('matches the occluded band below the visual viewport', () => {
    // keyboard covers bottom 300; visual viewport is top 500
    assert.equal(fixedBarBottomAboveVisualViewport(800, 0, 500), 300);
  });

  it('accounts for visualViewport.offsetTop (iOS pinch/scroll)', () => {
    assert.equal(fixedBarBottomAboveVisualViewport(800, 40, 460), 300);
  });
});
