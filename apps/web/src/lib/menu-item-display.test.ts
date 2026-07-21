import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatCartMenuLineLabel,
  formatMenuCatalogItemLabel,
  formatOnScreenMenuItemLabel,
  resolveMenuItemLocalizedName,
} from '@/lib/menu-item-display';
import type { MenuItem } from '@/types';

const baseItem: MenuItem = {
  id: '1',
  restaurant_id: 'r1',
  name_pt: 'Água 500ml',
  name_en: 'Water 500ml',
  name_zh: '矿泉水',
  price: 1.5,
  vat_rate: 23,
  category: 'Bebidas',
  emoji: '💧',
  available: true,
  sort_order: 1,
  created_at: '',
};

describe('resolveMenuItemLocalizedName', () => {
  it('prefers zh then pt', () => {
    assert.equal(resolveMenuItemLocalizedName(baseItem, 'zh'), '矿泉水');
  });

  it('prefers en then pt', () => {
    assert.equal(resolveMenuItemLocalizedName(baseItem, 'en'), 'Water 500ml');
  });

  it('falls back to pt for pt lang', () => {
    assert.equal(resolveMenuItemLocalizedName(baseItem, 'pt'), 'Água 500ml');
  });
});

describe('formatOnScreenMenuItemLabel', () => {
  it('joins normalized code and name with a space', () => {
    assert.equal(formatOnScreenMenuItemLabel('Água 500ml', ' 001 '), '001 Água 500ml');
  });

  it('returns name only when code is missing', () => {
    assert.equal(formatOnScreenMenuItemLabel('Água 500ml', null), 'Água 500ml');
  });

  it('caps code length consistently with print storage', () => {
    assert.equal(
      formatOnScreenMenuItemLabel('Test', '12345678901'),
      '1234567890 Test',
    );
  });
});

describe('formatMenuCatalogItemLabel', () => {
  it('uses item_code from catalog row', () => {
    assert.equal(
      formatMenuCatalogItemLabel({ ...baseItem, item_code: '028' }, 'zh'),
      '028 矿泉水',
    );
  });
});

describe('formatCartMenuLineLabel', () => {
  it('matches catalog label when lookup code is provided', () => {
    assert.equal(
      formatCartMenuLineLabel(baseItem, 'en', '028'),
      '028 Water 500ml',
    );
  });
});
