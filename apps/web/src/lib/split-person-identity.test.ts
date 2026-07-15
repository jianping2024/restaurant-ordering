import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  displaySplitPersonName,
  resolveSplitPersonDisplayName,
  splitPersonKey,
} from './split-person-identity';

describe('splitPersonKey', () => {
  it('trims and lowercases', () => {
    assert.equal(splitPersonKey('  Tom '), 'tom');
    assert.equal(splitPersonKey('tom'), 'tom');
  });
});

describe('displaySplitPersonName', () => {
  it('title-cases Latin names', () => {
    assert.equal(displaySplitPersonName('tom'), 'Tom');
    assert.equal(displaySplitPersonName('JACK'), 'Jack');
  });

  it('leaves non-Latin names unchanged', () => {
    assert.equal(displaySplitPersonName('张三'), '张三');
  });
});

describe('resolveSplitPersonDisplayName', () => {
  it('keeps existing spelling when present', () => {
    assert.equal(resolveSplitPersonDisplayName('TOM', 'tom'), 'TOM');
  });

  it('normalizes incoming when no existing row', () => {
    assert.equal(resolveSplitPersonDisplayName(undefined, 'jack'), 'Jack');
  });
});
