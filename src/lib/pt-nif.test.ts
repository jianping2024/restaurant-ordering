import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatPortugueseNif,
  normalizePortugueseNif,
  parsePortugueseNif,
  validatePortugueseNif,
} from './pt-nif';

describe('normalizePortugueseNif', () => {
  it('strips spaces and non-digits', () => {
    assert.equal(normalizePortugueseNif('123 456 789'), '123456789');
    assert.equal(normalizePortugueseNif('123.456.789'), '123456789');
  });

  it('caps at 9 digits', () => {
    assert.equal(normalizePortugueseNif('1234567890123'), '123456789');
  });
});

describe('formatPortugueseNif', () => {
  it('groups digits in threes', () => {
    assert.equal(formatPortugueseNif('123456789'), '123 456 789');
    assert.equal(formatPortugueseNif('12345'), '123 45');
  });
});

describe('validatePortugueseNif', () => {
  it('accepts empty input', () => {
    assert.equal(validatePortugueseNif(''), true);
    assert.equal(validatePortugueseNif('   '), true);
  });

  it('accepts known valid NIFs', () => {
    assert.equal(validatePortugueseNif('123456789'), true);
    assert.equal(validatePortugueseNif('502 757 191'), true);
  });

  it('rejects wrong length, leading zero, and bad check digit', () => {
    assert.equal(validatePortugueseNif('12345678'), false);
    assert.equal(validatePortugueseNif('023456789'), false);
    assert.equal(validatePortugueseNif('123456780'), false);
  });
});

describe('parsePortugueseNif', () => {
  it('returns null for empty or invalid values', () => {
    assert.equal(parsePortugueseNif(''), null);
    assert.equal(parsePortugueseNif('123456780'), null);
    assert.equal(parsePortugueseNif(123), null);
  });

  it('returns normalized digits for valid input', () => {
    assert.equal(parsePortugueseNif('502 757 191'), '502757191');
  });
});
