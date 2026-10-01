import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FLAVOR_CODES,
  isFlavorCode,
  normalizeFlavorCodes,
  resolveMenuItemFlavorPresentation,
  toggleFlavorCodeInDraft,
} from './flavors';

describe('flavors', () => {
  it('lists the locked display dictionary without spice_none', () => {
    assert.equal(FLAVOR_CODES.length, 15);
    assert.ok(isFlavorCode('spice_mild'));
    assert.equal(isFlavorCode('spice_none'), false);
    assert.equal(isFlavorCode('spicy'), false);
  });

  it('normalizes exclusive spice/numb/body to last pick; sour/sweet/sweet_sour may coexist', () => {
    assert.deepEqual(
      normalizeFlavorCodes([
        'spice_mild',
        'sour',
        'sweet',
        'sweet_sour',
        'spice_extra',
        'aroma_garlic',
        'sour',
      ]),
      ['spice_extra', 'sour', 'sweet', 'sweet_sour', 'aroma_garlic'],
    );
    assert.deepEqual(normalizeFlavorCodes(['light', 'heavy']), ['heavy']);
    assert.deepEqual(normalizeFlavorCodes([]), []);
  });

  it('rejects unknown codes or bad shape', () => {
    assert.equal(normalizeFlavorCodes(['spice_mild', 'hot']), null);
    assert.equal(normalizeFlavorCodes('spice_mild'), null);
    assert.equal(normalizeFlavorCodes([1]), null);
    assert.equal(normalizeFlavorCodes(null), null);
  });

  it('presents text labels only', () => {
    const chips = resolveMenuItemFlavorPresentation(
      ['spice_medium', 'numb_mild', 'aroma_cumin'],
      'zh',
    );
    assert.deepEqual(chips, [
      { code: 'spice_medium', label: '中辣' },
      { code: 'numb_mild', label: '微麻' },
      { code: 'aroma_cumin', label: '孜然香' },
    ]);
  });

  it('toggles exclusive spice like a radio in the staff draft', () => {
    assert.deepEqual(toggleFlavorCodeInDraft([], 'spice_mild'), ['spice_mild']);
    assert.deepEqual(toggleFlavorCodeInDraft(['spice_mild'], 'spice_extra'), ['spice_extra']);
    assert.deepEqual(toggleFlavorCodeInDraft(['spice_extra'], 'spice_extra'), []);
    assert.deepEqual(
      toggleFlavorCodeInDraft(['spice_mild', 'sour'], 'aroma_garlic'),
      ['spice_mild', 'sour', 'aroma_garlic'],
    );
  });
});
