import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appearanceChromeIconButtonClass } from './appearance-chrome';

describe('appearanceChromeIconButtonClass', () => {
  it('uses a single ≥44px circular touch target', () => {
    const className = appearanceChromeIconButtonClass();
    assert.match(className, /\bh-11\b/);
    assert.match(className, /\bw-11\b/);
    assert.doesNotMatch(className, /\bh-9\b/);
  });
});
