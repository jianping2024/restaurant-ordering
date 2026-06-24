import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCountryCode } from './country-code';

describe('normalizeCountryCode', () => {
  it('accepts known codes case-insensitively', () => {
    assert.equal(normalizeCountryCode('pt'), 'PT');
    assert.equal(normalizeCountryCode('CN'), 'CN');
  });

  it('rejects unknown or invalid codes', () => {
    assert.equal(normalizeCountryCode('XX'), null);
    assert.equal(normalizeCountryCode('POR'), null);
    assert.equal(normalizeCountryCode(''), null);
  });
});
