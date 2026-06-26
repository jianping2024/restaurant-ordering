import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_MENU_VAT_RATE,
  isAllowedMenuVatRate,
  normalizeMenuVatRate,
  parseMenuVatRate,
} from './menu-vat-rate';

describe('parseMenuVatRate', () => {
  it('accepts allowed numeric rates', () => {
    assert.equal(parseMenuVatRate(23), 23);
    assert.equal(parseMenuVatRate('13'), 13);
    assert.equal(parseMenuVatRate(0), 0);
  });

  it('rejects invalid values', () => {
    assert.equal(parseMenuVatRate(''), null);
    assert.equal(parseMenuVatRate(null), null);
    assert.equal(parseMenuVatRate(undefined), null);
    assert.equal(parseMenuVatRate('abc'), null);
    assert.equal(parseMenuVatRate(-1), null);
    assert.equal(parseMenuVatRate(101), null);
  });
});

describe('normalizeMenuVatRate', () => {
  it('falls back to the default rate', () => {
    assert.equal(normalizeMenuVatRate(undefined), DEFAULT_MENU_VAT_RATE);
    assert.equal(normalizeMenuVatRate(''), DEFAULT_MENU_VAT_RATE);
    assert.equal(normalizeMenuVatRate('bad'), DEFAULT_MENU_VAT_RATE);
  });

  it('keeps valid rates', () => {
    assert.equal(normalizeMenuVatRate(6), 6);
    assert.equal(normalizeMenuVatRate('0'), 0);
  });
});

describe('isAllowedMenuVatRate', () => {
  it('matches configured options only', () => {
    assert.equal(isAllowedMenuVatRate(23), true);
    assert.equal(isAllowedMenuVatRate(5), false);
  });
});
