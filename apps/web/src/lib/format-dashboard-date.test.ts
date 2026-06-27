import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatOrderDateTime, formatOverviewDate } from '@/lib/format-dashboard-date';

describe('formatOverviewDate', () => {
  it('formats zh overview with stable weekday spacing', () => {
    const label = formatOverviewDate('zh', new Date('2026-06-27T10:00:00.000Z'));
    assert.match(label, /2026年/);
    assert.match(label, /日\s/);
  });

  it('formats en overview', () => {
    const label = formatOverviewDate('en', new Date('2026-06-27T10:00:00.000Z'));
    assert.match(label, /2026/);
    assert.match(label, /June/i);
  });
});

describe('formatOrderDateTime', () => {
  it('formats order timestamps per language locale', () => {
    const iso = '2026-06-27T14:30:00.000Z';
    const zh = formatOrderDateTime('zh', iso);
    const en = formatOrderDateTime('en', iso);
    assert.notEqual(zh, en);
    assert.match(zh, /\d/);
    assert.match(en, /\d/);
  });
});
