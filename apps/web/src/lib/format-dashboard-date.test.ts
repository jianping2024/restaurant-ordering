import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatOrderDateTime, formatOverviewDate, formatCollectedPaymentTime } from '@/lib/format-dashboard-date';

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

describe('formatCollectedPaymentTime', () => {
  it('shows time only when payment is on the same dashboard day', () => {
    const now = new Date('2026-06-27T12:00:00.000Z');
    const iso = '2026-06-27T14:30:00.000Z';
    const label = formatCollectedPaymentTime('en', iso, now);
    assert.doesNotMatch(label, /\//);
    assert.match(label, /\d/);
  });

  it('includes date when payment is on a prior dashboard day', () => {
    const now = new Date('2026-06-28T12:00:00.000Z');
    const iso = '2026-06-27T14:30:00.000Z';
    const label = formatCollectedPaymentTime('en', iso, now);
    assert.match(label, /\d/);
    assert.notEqual(label, formatCollectedPaymentTime('en', iso, new Date(iso)));
  });
});
