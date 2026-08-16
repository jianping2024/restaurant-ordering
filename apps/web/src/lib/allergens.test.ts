import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALLERGEN_CODES,
  isAllergenCode,
  normalizeAllergenCodes,
} from './allergens';

describe('allergens', () => {
  it('lists exactly the EU 14 codes', () => {
    assert.equal(ALLERGEN_CODES.length, 14);
    assert.ok(isAllergenCode('egg'));
    assert.equal(isAllergenCode('shellfish'), false);
  });

  it('normalizes and dedupes valid codes', () => {
    assert.deepEqual(normalizeAllergenCodes(['egg', 'milk', 'egg']), ['egg', 'milk']);
    assert.deepEqual(normalizeAllergenCodes([]), []);
  });

  it('rejects unknown codes or bad shape', () => {
    assert.equal(normalizeAllergenCodes(['egg', 'shellfish']), null);
    assert.equal(normalizeAllergenCodes('egg'), null);
    assert.equal(normalizeAllergenCodes([1]), null);
    assert.equal(normalizeAllergenCodes(null), null);
  });
});
