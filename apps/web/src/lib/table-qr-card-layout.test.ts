import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fitSingleLineFontSize,
  resolveTableQrGroupLabel,
} from './table-qr-card-layout';

describe('resolveTableQrGroupLabel', () => {
  it('returns ungrouped label when table has no group', () => {
    assert.equal(resolveTableQrGroupLabel('t1', {}, '未分组'), '未分组');
  });

  it('returns group name when assigned', () => {
    assert.equal(resolveTableQrGroupLabel('t1', { t1: '大厅1' }, '未分组'), '大厅1');
  });
});

describe('fitSingleLineFontSize', () => {
  it('shrinks font until text fits', () => {
    const size = fitSingleLineFontSize(
      'VERY-LONG-TABLE',
      100,
      42,
      20,
      (value, fontSize) => value.length * fontSize * 0.6,
    );
    assert.ok(size < 42);
    assert.ok(size >= 20);
  });
});
