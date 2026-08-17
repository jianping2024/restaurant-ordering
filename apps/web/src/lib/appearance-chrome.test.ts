import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appearanceChromeButtonClass } from './appearance-chrome';

describe('appearanceChromeButtonClass', () => {
  it('uses a single ≥44px ghost icon target without a painted ring', () => {
    const className = appearanceChromeButtonClass('icon');
    assert.match(className, /\bh-11\b/);
    assert.match(className, /\bw-11\b/);
    assert.doesNotMatch(className, /\bh-9\b/);
    assert.doesNotMatch(className, /\bborder\b/);
    assert.doesNotMatch(className, /\bbg-brand-bg\b/);
  });

  it('keeps the compact language label on the same 44px height', () => {
    const className = appearanceChromeButtonClass('label');
    assert.match(className, /\bh-11\b/);
    assert.match(className, /\brounded-full\b/);
    assert.doesNotMatch(className, /\bw-11\b/);
  });
});
