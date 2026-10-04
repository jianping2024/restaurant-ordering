import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appearanceChromeButtonClass,
  appearanceChromeGroupClass,
} from './appearance-chrome';

describe('appearanceChromeButtonClass', () => {
  it('uses a single ≥44px ghost icon target without a painted ring', () => {
    const className = appearanceChromeButtonClass('icon');
    assert.match(className, /\bh-11\b/);
    assert.match(className, /\bw-11\b/);
    assert.doesNotMatch(className, /\bh-9\b/);
    assert.doesNotMatch(className, /\bborder\b/);
    assert.doesNotMatch(className, /\bbg-brand-bg\b/);
  });

  it('keeps capsule segments at 44px hit height and ≥44px width', () => {
    const className = appearanceChromeButtonClass('segment');
    assert.match(className, /\bh-11\b/);
    assert.match(className, /\bmin-w-11\b/);
    assert.doesNotMatch(className, /(^|\s)w-11\b/);
  });
});

describe('appearanceChromeGroupClass', () => {
  it('is one bordered 36px capsule (segments overflow vertically, not clipped)', () => {
    assert.match(appearanceChromeGroupClass, /\bh-9\b/);
    assert.match(appearanceChromeGroupClass, /\brounded-full\b/);
    assert.match(appearanceChromeGroupClass, /\bborder\b/);
    assert.doesNotMatch(appearanceChromeGroupClass, /overflow-hidden/);
  });
});
