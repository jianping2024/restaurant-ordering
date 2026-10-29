import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MenuCategory, MenuItem } from '@/types';
import {
  customerMenuNavTopCategories,
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
      menuTimeSlotId: null,
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
      menuTimeSlotId: null,
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
      menuTimeSlotId: null,
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
      menuTimeSlotId: null,
      activeTopId: 'c-mains',
      activeSubpath: 'c-fish',
    });
    assert.equal(view.currentTopId, 'c-mains');
    assert.equal(view.currentSubpath, 'c-fish');
    assert.deepEqual(view.currentItems.map((row) => row.id), ['i-bacalhau']);
  });

  it('time slot: hides other-slot dishes, recommended and categories emptied by the slot', () => {
    const lunchSet = item({ id: 'i-lunch', category_id: 'c-fish', available: true, time_slot_id: 'lunch' });
    const dinnerOnly = cat({ id: 'c-dinner', name_pt: 'Jantar', sort_order: 3 });
    const dinnerDish = item({ id: 'i-dinner', category_id: 'c-dinner', available: true, time_slot_id: 'dinner' });
    const empty = cat({ id: 'c-empty', name_pt: 'Vazio', sort_order: 4 });
    const args = {
      menuCategories: [mains, fish, drinks, dinnerOnly, empty],
      menuItems: [lunchSet, frango, vinho, dinnerDish],
      recommendedItemIds: ['i-dinner', 'i-lunch', 'i-vinho'],
      activeTopId: 'c-mains',
      activeSubpath: '',
    };

    const atLunch = resolveCustomerMenuCatalogView({ ...args, menuTimeSlotId: 'lunch' });
    assert.deepEqual(atLunch.realTopCategories.map((c) => c.id), ['c-mains', 'c-drinks']);
    assert.deepEqual(atLunch.subCategories.map((c) => c.id), ['c-fish']);
    assert.deepEqual(atLunch.recommendedItems.map((r) => r.id), ['i-lunch', 'i-vinho']);
    assert.deepEqual(atLunch.currentItems.map((r) => r.id).sort(), ['i-frango', 'i-lunch']);

    const atDinner = resolveCustomerMenuCatalogView({ ...args, menuTimeSlotId: 'dinner' });
    assert.deepEqual(
      atDinner.realTopCategories.map((c) => c.id),
      ['c-mains', 'c-drinks', 'c-dinner'],
    );
    assert.deepEqual(atDinner.subCategories.map((c) => c.id), []);
    assert.deepEqual(atDinner.recommendedItems.map((r) => r.id), ['i-dinner', 'i-vinho']);
    assert.deepEqual(atDinner.currentItems.map((r) => r.id), ['i-frango']);

    const allDayOnly = resolveCustomerMenuCatalogView({
      ...args,
      activeTopId: 'c-dinner',
      menuTimeSlotId: null,
    });
    assert.equal(allDayOnly.currentTopId, 'c-mains');
    assert.ok(!allDayOnly.realTopCategories.some((c) => c.id === 'c-empty'));
  });

  it('takeaway: hides categories with no sellable dishes; dine-in keeps them when they have dine-in dishes', () => {
    const dineOnlyCat = cat({ id: 'c-dine-only', name_pt: 'Só sala', sort_order: 3 });
    const empty = cat({ id: 'c-empty', name_pt: 'Vazio', sort_order: 4 });
    const dineDish = item({
      id: 'i-dine',
      category_id: 'c-dine-only',
      available: true,
      takeaway_role: 'none',
    });
    const sellDish = item({
      id: 'i-sell',
      category_id: 'c-drinks',
      available: true,
      takeaway_role: 'sellable',
      takeaway_price: 2.5,
    });
    const packDish = item({
      id: 'i-pack',
      category_id: 'c-mains',
      available: true,
      takeaway_role: 'packaging',
    });
    const cats = [mains, drinks, dineOnlyCat, empty];
    const items = [dineDish, sellDish, packDish, frango];

    const takeaway = resolveCustomerMenuCatalogView({
      menuCategories: cats,
      menuItems: items,
      recommendedItemIds: ['i-sell', 'i-dine'],
      menuTimeSlotId: null,
      activeTopId: 'c-dine-only',
      activeSubpath: '',
      orderingChannel: 'takeaway',
    });
    assert.deepEqual(takeaway.realTopCategories.map((c) => c.id), ['c-drinks']);
    assert.equal(takeaway.currentTopId, 'c-drinks');
    assert.deepEqual(takeaway.currentItems.map((r) => r.id), ['i-sell']);
    assert.deepEqual(takeaway.recommendedItems.map((r) => r.id), ['i-sell']);

    const dineIn = resolveCustomerMenuCatalogView({
      menuCategories: cats,
      menuItems: items,
      recommendedItemIds: [],
      menuTimeSlotId: null,
      activeTopId: '',
      activeSubpath: '',
      orderingChannel: 'dine_in',
    });
    assert.deepEqual(dineIn.realTopCategories.map((c) => c.id), ['c-mains', 'c-drinks', 'c-dine-only']);
    assert.ok(!dineIn.realTopCategories.some((c) => c.id === 'c-empty'));
    assert.ok(!dineIn.currentItems.some((r) => r.id === 'i-pack'));
  });
});

describe('customerMenuNavTopCategories', () => {
  it('lists only real top categories even when recommended dishes exist', () => {
    const withRec = resolveCustomerMenuCatalogView({
      menuCategories: [mains, drinks],
      menuItems: [vinho],
      recommendedItemIds: ['i-vinho'],
      menuTimeSlotId: null,
      activeTopId: '',
      activeSubpath: '',
    });
    assert.deepEqual(
      customerMenuNavTopCategories(withRec, (c) => c.name_pt).map((c) => c.id),
      ['c-drinks'],
    );
    assert.deepEqual(withRec.recommendedItems.map((row) => row.id), ['i-vinho']);

    const without = resolveCustomerMenuCatalogView({
      menuCategories: [mains],
      menuItems: [frango],
      recommendedItemIds: [],
      menuTimeSlotId: null,
      activeTopId: '',
      activeSubpath: '',
    });
    assert.deepEqual(
      customerMenuNavTopCategories(without, (c) => c.name_pt).map((c) => c.id),
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
