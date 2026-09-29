import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMenuNotePresetCatalog,
  composeCartLineNote,
  menuNotePresetLocalizedName,
  normalizeMenuItemNotePresetGroupIds,
  toggleCartNotePresetSelection,
  type MenuNotePresetCatalog,
} from './menu-note-presets.ts';

describe('normalizeMenuItemNotePresetGroupIds', () => {
  it('accepts unique restaurant group ids', () => {
    const allowed = new Set([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
    const keys = normalizeMenuItemNotePresetGroupIds(
      ['11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'],
      allowed,
    );
    assert.deepEqual(keys, ['11111111-1111-4111-8111-111111111111']);
  });

  it('rejects unknown ids', () => {
    const allowed = new Set(['11111111-1111-4111-8111-111111111111']);
    const keys = normalizeMenuItemNotePresetGroupIds(
      ['22222222-2222-4222-8222-222222222222'],
      allowed,
    );
    assert.equal(!Array.isArray(keys) && keys.error, 'invalid_note_preset_group_ids');
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

const sampleCatalog: MenuNotePresetCatalog = {
  groups: [
    {
      id: 'g-spice',
      name_en: 'Spice',
      name_pt: 'Picante',
      name_zh: '辣度',
      presets: [
        { id: 'p-mild', name_en: 'Mild', name_pt: 'Suave', name_zh: '微辣' },
        { id: 'p-hot', name_en: 'Hot', name_pt: 'Forte', name_zh: '特辣' },
      ],
    },
    {
      id: 'g-salt',
      name_en: 'Salt',
      name_pt: 'Sal',
      name_zh: '盐',
      presets: [{ id: 'p-salt', name_en: 'Less salt', name_pt: 'Pouco sal', name_zh: '少盐' }],
    },
  ],
};

describe('toggleCartNotePresetSelection', () => {
  it('single-selects within a group and allows one pick per group', () => {
    let selected = toggleCartNotePresetSelection([], sampleCatalog, 'p-mild');
    assert.deepEqual(selected, ['p-mild']);
    selected = toggleCartNotePresetSelection(selected, sampleCatalog, 'p-hot');
    assert.deepEqual(selected, ['p-hot']);
    selected = toggleCartNotePresetSelection(selected, sampleCatalog, 'p-salt');
    assert.deepEqual(selected, ['p-hot', 'p-salt']);
    selected = toggleCartNotePresetSelection(selected, sampleCatalog, 'p-hot');
    assert.deepEqual(selected, ['p-salt']);
  });
});

describe('composeCartLineNote', () => {
  it('joins selected labels then free text', () => {
    const note = composeCartLineNote({
      freeText: '不要香菜',
      selectedNotePresetIds: ['p-salt', 'p-mild'],
      catalog: sampleCatalog,
      lang: 'zh',
    });
    assert.equal(note, '微辣; 少盐; 不要香菜');
  });
});
