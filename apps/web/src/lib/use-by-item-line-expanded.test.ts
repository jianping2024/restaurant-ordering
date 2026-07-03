import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BY_ITEM_LINE_DEFAULT_EXPANDED,
  resolveByItemLineExpanded,
} from './by-item-line-expanded';

describe('resolveByItemLineExpanded', () => {
  it('defaults to expanded', () => {
    assert.equal(BY_ITEM_LINE_DEFAULT_EXPANDED, true);
    assert.equal(resolveByItemLineExpanded(undefined), true);
  });

  it('respects user collapse override', () => {
    assert.equal(resolveByItemLineExpanded(false), false);
  });

  it('respects user expand override', () => {
    assert.equal(resolveByItemLineExpanded(true), true);
  });
});
