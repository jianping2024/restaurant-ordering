import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterMenuItemsByDietaryPrefs,
  normalizeExcludeAllergenCodes,
  toggleExcludeAllergenCode,
} from '@/lib/customer-menu-dietary-filter';
import type { MenuItem } from '@/types';

function item(partial: Partial<MenuItem> & Pick<MenuItem, 'id'>): MenuItem {
  return {
    restaurant_id: 'r1',
    name_pt: partial.name_pt ?? 'x',
    price: 1,
    vat_rate: 6,
    category: 'c',
    emoji: '🍽️',
    available: true,
    sort_order: 0,
    created_at: '',
    is_vegetarian: false,
    allergen_codes: [],
    ...partial,
  };
}

describe('filterMenuItemsByDietaryPrefs', () => {
  const veg = item({ id: 'v', is_vegetarian: true, allergen_codes: [] });
  const milk = item({ id: 'm', is_vegetarian: true, allergen_codes: ['milk'] });
  const meat = item({ id: 'x', is_vegetarian: false, allergen_codes: ['gluten'] });
  const unmarked = item({ id: 'u', is_vegetarian: false, allergen_codes: [] });

  it('returns all when prefs empty', () => {
    const out = filterMenuItemsByDietaryPrefs([veg, milk, meat], {
      vegetarianOnly: false,
      excludeAllergenCodes: [],
    });
    assert.equal(out.length, 3);
  });

  it('keeps only vegetarian when lamp on', () => {
    const out = filterMenuItemsByDietaryPrefs([veg, milk, meat, unmarked], {
      vegetarianOnly: true,
      excludeAllergenCodes: [],
    });
    assert.deepEqual(
      out.map((i) => i.id),
      ['v', 'm'],
    );
  });

  it('avoids marked allergens; unmarked stays', () => {
    const out = filterMenuItemsByDietaryPrefs([veg, milk, meat, unmarked], {
      vegetarianOnly: false,
      excludeAllergenCodes: ['milk'],
    });
    assert.deepEqual(
      out.map((i) => i.id),
      ['v', 'x', 'u'],
    );
  });

  it('combines vegetarian and allergen avoid', () => {
    const out = filterMenuItemsByDietaryPrefs([veg, milk, meat], {
      vegetarianOnly: true,
      excludeAllergenCodes: ['milk'],
    });
    assert.deepEqual(
      out.map((i) => i.id),
      ['v'],
    );
  });
});

describe('normalizeExcludeAllergenCodes / toggle', () => {
  it('drops unknown and dedupes', () => {
    assert.deepEqual(normalizeExcludeAllergenCodes(['milk', 'nope', 'milk']), ['milk']);
  });

  it('toggles membership', () => {
    assert.deepEqual(toggleExcludeAllergenCode(['milk'], 'egg'), ['milk', 'egg']);
    assert.deepEqual(toggleExcludeAllergenCode(['milk', 'egg'], 'milk'), ['egg']);
  });
});
