import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { restaurantCityFromAddress, storeMatchesSearch } from './restaurant-city';

describe('restaurantCityFromAddress', () => {
  it('last segment without postal code / country', () => {
    assert.equal(restaurantCityFromAddress('Rua Augusta 100, 1100-053 Lisboa'), 'Lisboa');
    assert.equal(restaurantCityFromAddress('Av. da Boavista 1, Porto, Portugal'), 'Porto');
    assert.equal(restaurantCityFromAddress('1000-001 Lisboa'), 'Lisboa');
    assert.equal(restaurantCityFromAddress(null), '');
    assert.equal(restaurantCityFromAddress('  '), '');
  });
});

describe('storeMatchesSearch', () => {
  const store = { name: 'Sushi Évora', city: 'Évora', slug: 'sushi-evora' };
  it('matches name / city / slug, case- and accent-insensitive', () => {
    assert.ok(storeMatchesSearch(store, 'EVORA'));
    assert.ok(storeMatchesSearch(store, 'sushi'));
    assert.ok(storeMatchesSearch(store, '  '));
    assert.ok(!storeMatchesSearch(store, 'porto'));
  });
});
