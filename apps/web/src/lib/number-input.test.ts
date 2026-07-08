import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatHmDigitsWhileTyping,
  normalizeHmInput,
  parseNonNegativeInt,
  sanitizeIntegerDraft,
} from '@/lib/number-input';

describe('sanitizeIntegerDraft', () => {
  it('keeps digits only without clamping', () => {
    assert.equal(sanitizeIntegerDraft('1'), '1');
    assert.equal(sanitizeIntegerDraft('10a'), '10');
    assert.equal(sanitizeIntegerDraft(''), '');
  });
});

describe('parseNonNegativeInt', () => {
  it('clamps on commit with min/max', () => {
    assert.equal(parseNonNegativeInt('1', { min: 5, max: 60, empty: 5 }), 5);
    assert.equal(parseNonNegativeInt('10', { min: 5, max: 60, empty: 5 }), 10);
    assert.equal(parseNonNegativeInt('99', { min: 5, max: 60, empty: 5 }), 60);
    assert.equal(parseNonNegativeInt('', { min: 5, max: 60, empty: 5 }), 5);
  });
});

describe('formatHmDigitsWhileTyping', () => {
  it('auto-inserts colon after hour digits', () => {
    assert.equal(formatHmDigitsWhileTyping('1'), '1');
    assert.equal(formatHmDigitsWhileTyping('19'), '19');
    assert.equal(formatHmDigitsWhileTyping('190'), '19:0');
    assert.equal(formatHmDigitsWhileTyping('1900'), '19:00');
  });

  it('rejects hour above 23', () => {
    assert.equal(formatHmDigitsWhileTyping('24'), '2');
    assert.equal(formatHmDigitsWhileTyping('29'), '2');
  });

  it('rejects minutes above 59', () => {
    assert.equal(formatHmDigitsWhileTyping('2360'), '23:6');
    assert.equal(formatHmDigitsWhileTyping('2399'), '23:9');
  });

  it('strips non-digits and ignores existing colon', () => {
    assert.equal(formatHmDigitsWhileTyping('19:00'), '19:00');
    assert.equal(formatHmDigitsWhileTyping('ab19:30cd'), '19:30');
  });
});

describe('normalizeHmInput', () => {
  it('completes partial digit-only input on blur', () => {
    assert.equal(normalizeHmInput('8'), '08:00');
    assert.equal(normalizeHmInput('19'), '19:00');
    assert.equal(normalizeHmInput('830'), '08:30');
    assert.equal(normalizeHmInput('1900'), '19:00');
  });

  it('completes partial colon input on blur', () => {
    assert.equal(normalizeHmInput('19:3'), '19:30');
    assert.equal(normalizeHmInput('19:0'), '19:00');
    assert.equal(normalizeHmInput('8:30'), '08:30');
  });

  it('accepts full HH:MM', () => {
    assert.equal(normalizeHmInput('18:00'), '18:00');
    assert.equal(normalizeHmInput('23:59'), '23:59');
  });

  it('rejects invalid times', () => {
    assert.equal(normalizeHmInput(''), null);
    assert.equal(normalizeHmInput('24:00'), null);
    assert.equal(normalizeHmInput('12:60'), null);
    assert.equal(normalizeHmInput('99'), null);
    assert.equal(normalizeHmInput('0199'), null);
  });
});
