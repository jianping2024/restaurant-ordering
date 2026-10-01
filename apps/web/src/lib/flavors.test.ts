import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FLAVOR_CODES,
  FLAVOR_CODES_MAX_SELECTED,
  flavorDraftPickBlocked,
  isFlavorCode,
  normalizeFlavorCodes,
  resolveMenuItemFlavorPresentation,
  toggleFlavorCodeInDraft,
} from './flavors';

describe('flavors', () => {
  it('lists the locked display dictionary without spice_none', () => {
    assert.equal(FLAVOR_CODES.length, 15);
    assert.equal(FLAVOR_CODES_MAX_SELECTED, 3);
    assert.ok(isFlavorCode('spice_mild'));
    assert.equal(isFlavorCode('spice_none'), false);
    assert.equal(isFlavorCode('spicy'), false);
  });

  it('normalizes exclusive spice/numb/body to last pick; sour/sweet/sweet_sour may coexist within cap', () => {
    assert.deepEqual(
      normalizeFlavorCodes(['spice_mild', 'sour', 'spice_extra', 'aroma_garlic']),
      ['spice_extra', 'sour', 'aroma_garlic'],
    );
    assert.deepEqual(normalizeFlavorCodes(['light', 'heavy']), ['heavy']);
    assert.deepEqual(normalizeFlavorCodes([]), []);
  });

  it('rejects over FLAVOR_CODES_MAX_SELECTED after exclusive collapse', () => {
    assert.equal(
      normalizeFlavorCodes(['spice_extra', 'sour', 'sweet', 'sweet_sour', 'aroma_garlic']),
      null,
    );
    assert.equal(
      normalizeFlavorCodes(['spice_mild', 'numb_mild', 'light', 'umami']),
      null,
    );
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

  it('refuses a fourth pick but still allows exclusive replace at the cap', () => {
    const atCap = ['spice_mild', 'sour', 'umami'] as const;
    assert.deepEqual(toggleFlavorCodeInDraft(atCap, 'aroma_garlic'), [...atCap]);
    assert.deepEqual(toggleFlavorCodeInDraft(atCap, 'numb_mild'), [...atCap]);
    assert.deepEqual(toggleFlavorCodeInDraft(atCap, 'spice_extra'), [
      'spice_extra',
      'sour',
      'umami',
    ]);
    assert.deepEqual(toggleFlavorCodeInDraft(atCap, 'sour'), ['spice_mild', 'umami']);
    assert.equal(flavorDraftPickBlocked(atCap, 'aroma_garlic'), true);
    assert.equal(flavorDraftPickBlocked(atCap, 'numb_mild'), true);
    assert.equal(flavorDraftPickBlocked(atCap, 'spice_extra'), false);
    assert.equal(flavorDraftPickBlocked(atCap, 'spice_mild'), false);
    assert.equal(flavorDraftPickBlocked(atCap, 'sour'), false);
  });
});
