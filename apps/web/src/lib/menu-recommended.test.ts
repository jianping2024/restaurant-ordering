import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MenuCategory, MenuItem } from '@/types';
import {
  customerMenuStripTopCategories,
  MENU_RECOMMENDED_ITEMS_MAX,
  parseRecommendedMenuItemIds,
  resolveCustomerMenuCatalogView,
  visibleRecommendedMenuItems,
} from './menu-recommended.ts';
import { filterRecommendedPickerItems } from './menu-admin.ts';

const cat = (row: Partial<MenuCategory> & Pick<MenuCategory, 'id'>): MenuCategory => ({
  restaurant_id: 'r1',
  parent_id: null,
  name_pt: row.id,
  sort_order: 0,
  active: true,
  created_at: '',
  ...row,
});

const item = (
  row: Partial<MenuItem> & Pick<MenuItem, 'id' | 'category_id' | 'available'>,
): MenuItem => ({
  restaurant_id: 'r1',
  name_pt: row.id,
  price: 1,
  vat_rate: 23,
  category: 'Pratos',
  emoji: '🍽️',
  sort_order: 0,
  created_at: '',
  ...row,
});

const mains = cat({ id: 'c-mains', name_pt: 'Pratos', sort_order: 1 });
const drinks = cat({ id: 'c-drinks', name_pt: 'Bebidas', sort_order: 2 });
const fish = cat({ id: 'c-fish', parent_id: 'c-mains', name_pt: 'Peixe', sort_order: 1 });

const bacalhau = item({ id: 'i-bacalhau', category_id: 'c-fish', available: true, sort_order: 1 });
const frango = item({ id: 'i-frango', category_id: 'c-mains', available: true, sort_order: 2 });
const vinho = item({ id: 'i-vinho', category_id: 'c-drinks', available: true, sort_order: 1 });
const soldOut = item({ id: 'i-sold', category_id: 'c-mains', available: false, sort_order: 3 });

describe('visibleRecommendedMenuItems', () => {
  it('keeps curated order and drops unavailable / missing ids', () => {
    assert.deepEqual(
      visibleRecommendedMenuItems(
        [frango, bacalhau, soldOut, vinho],
        ['i-sold', 'i-vinho', 'missing', 'i-bacalhau'],
      ).map((row) => row.id),
      ['i-vinho', 'i-bacalhau'],
    );
  });
});

describe('resolveCustomerMenuCatalogView', () => {
  it('defaults to first real category when nothing is recommended', () => {
    const view = resolveCustomerMenuCatalogView({
      menuCategories: [mains, drinks, fish],
      menuItems: [bacalhau, frango, vinho],
      recommendedItemIds: [],
      activeTopId: '',
      activeSubpath: '',
    });
    assert.equal(view.currentTopId, 'c-mains');
    assert.equal(view.recommendedItems.length, 0);
    assert.deepEqual(view.currentItems.map((row) => row.id).sort(), ['i-bacalhau', 'i-frango']);
  });

  it('defaults to first real category even when curated dishes are available', () => {
    const view = resolveCustomerMenuCatalogView({
      menuCategories: [mains, drinks],
      menuItems: [frango, vinho, soldOut],
      recommendedItemIds: ['i-sold', 'i-vinho'],
      activeTopId: 'Pratos',
      activeSubpath: '',
    });
    assert.equal(view.currentTopId, 'c-mains');
    assert.deepEqual(view.recommendedItems.map((row) => row.id), ['i-vinho']);
    assert.ok(view.currentItems.some((row) => row.id === 'i-frango'));
    assert.ok(!view.currentItems.some((row) => row.id === 'i-vinho'));
  });

  it('ignores a stale recommended sentinel as the active top', () => {
    const view = resolveCustomerMenuCatalogView({
      menuCategories: [mains],
      menuItems: [soldOut, frango],
      recommendedItemIds: ['i-sold'],
      activeTopId: 'recommended',
      activeSubpath: '',
    });
    assert.equal(view.currentTopId, 'c-mains');
    assert.equal(view.recommendedItems.length, 0);
  });

  it('keeps subcategory filtering on a real top category', () => {
    const view = resolveCustomerMenuCatalogView({
      menuCategories: [mains, fish, drinks],
      menuItems: [bacalhau, frango, vinho],
      recommendedItemIds: ['i-vinho'],
      activeTopId: 'c-mains',
      activeSubpath: 'c-fish',
    });
    assert.equal(view.currentTopId, 'c-mains');
    assert.equal(view.currentSubpath, 'c-fish');
    assert.deepEqual(view.currentItems.map((row) => row.id), ['i-bacalhau']);
  });
});

describe('customerMenuStripTopCategories', () => {
  it('lists only real top categories even when recommended dishes exist', () => {
    const withRec = resolveCustomerMenuCatalogView({
      menuCategories: [mains, drinks],
      menuItems: [vinho],
      recommendedItemIds: ['i-vinho'],
      activeTopId: '',
      activeSubpath: '',
    });
    assert.deepEqual(
      customerMenuStripTopCategories(withRec, (c) => c.name_pt).map((c) => c.id),
      ['c-mains', 'c-drinks'],
    );
    assert.deepEqual(withRec.recommendedItems.map((row) => row.id), ['i-vinho']);

    const without = resolveCustomerMenuCatalogView({
      menuCategories: [mains],
      menuItems: [frango],
      recommendedItemIds: [],
      activeTopId: '',
      activeSubpath: '',
    });
    assert.deepEqual(
      customerMenuStripTopCategories(without, (c) => c.name_pt).map((c) => c.id),
      ['c-mains'],
    );
  });

  it('caps the dashboard list at 12', () => {
    assert.equal(MENU_RECOMMENDED_ITEMS_MAX, 12);
  });
});

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

describe('parseRecommendedMenuItemIds', () => {
  it('keeps first-seen order and drops duplicates', () => {
    assert.deepEqual(parseRecommendedMenuItemIds([ID_A, ID_B, ID_A]), [ID_A, ID_B]);
  });

  it('rejects a missing array, empty list, or non-uuid', () => {
    assert.equal(parseRecommendedMenuItemIds(undefined), null);
    assert.equal(parseRecommendedMenuItemIds([]), null);
    assert.equal(parseRecommendedMenuItemIds([ID_A, 'not-a-uuid']), null);
    assert.equal(parseRecommendedMenuItemIds(ID_A), null);
  });
});

describe('filterRecommendedPickerItems', () => {
  it('limits to a top category including descendants', () => {
    const rows = filterRecommendedPickerItems(
      [bacalhau, frango, vinho],
      [mains, drinks, fish],
      'c-mains',
      '',
    );
    assert.deepEqual(rows.map((row) => row.id).sort(), ['i-bacalhau', 'i-frango']);
  });

  it('searches within the selected category', () => {
    const rows = filterRecommendedPickerItems(
      [bacalhau, frango, vinho],
      [mains, drinks, fish],
      'c-mains',
      'vinho',
    );
    assert.deepEqual(rows.map((row) => row.id), []);
    const hit = filterRecommendedPickerItems(
      [bacalhau, frango, vinho],
      [mains, drinks, fish],
      null,
      'vinho',
    );
    assert.deepEqual(hit.map((row) => row.id), ['i-vinho']);
  });
});
