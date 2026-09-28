import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMenuNotePresetCatalog,
  menuNotePresetLocalizedName,
  normalizeMenuItemNotePresetKeys,
} from './menu-note-presets.ts';

describe('normalizeMenuItemNotePresetKeys', () => {
  it('accepts unique restaurant preset ids', () => {
    const allowed = new Set([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
    const keys = normalizeMenuItemNotePresetKeys(
      ['11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'],
      allowed,
    );
    assert.deepEqual(keys, ['11111111-1111-4111-8111-111111111111']);
  });

  it('rejects unknown ids', () => {
    const allowed = new Set(['11111111-1111-4111-8111-111111111111']);
    const keys = normalizeMenuItemNotePresetKeys(
      ['22222222-2222-4222-8222-222222222222'],
      allowed,
    );
    assert.equal(!Array.isArray(keys) && keys.error, 'invalid_note_preset_keys');
  });
});

describe('menuNotePresetLocalizedName', () => {
  it('prefers zh when present else pt/en', () => {
    assert.equal(
      menuNotePresetLocalizedName(
        { name_en: 'Less salt', name_pt: 'Pouco sal', name_zh: '少盐' },
        'zh',
      ),
      '少盐',
    );
    assert.equal(
      menuNotePresetLocalizedName({ name_en: 'Less salt', name_pt: 'Pouco sal', name_zh: '' }, 'zh'),
      'Pouco sal',
    );
  });
});

describe('buildMenuNotePresetCatalog', () => {
  it('keeps only active groups with active presets', () => {
    const catalog = buildMenuNotePresetCatalog(
      [
        {
          id: 'g1',
          restaurant_id: 'r',
          name_en: 'Taste',
          name_pt: 'Sabor',
          name_zh: '口味',
          sort_order: 0,
          active: true,
        },
        {
          id: 'g2',
          restaurant_id: 'r',
          name_en: 'Off',
          name_pt: 'Off',
          name_zh: '',
          sort_order: 1,
          active: false,
        },
      ],
      [
        {
          id: 'p1',
          restaurant_id: 'r',
          group_id: 'g1',
          name_en: 'A',
          name_pt: 'A',
          name_zh: '',
          sort_order: 0,
          active: true,
        },
        {
          id: 'p2',
          restaurant_id: 'r',
          group_id: 'g1',
          name_en: 'B',
          name_pt: 'B',
          name_zh: '',
          sort_order: 1,
          active: false,
        },
        {
          id: 'p3',
          restaurant_id: 'r',
          group_id: 'g2',
          name_en: 'C',
          name_pt: 'C',
          name_zh: '',
          sort_order: 0,
          active: true,
        },
      ],
    );
    assert.equal(catalog.groups.length, 1);
    assert.equal(catalog.groups[0]?.presets.length, 1);
    assert.equal(catalog.groups[0]?.presets[0]?.id, 'p1');
  });
});
