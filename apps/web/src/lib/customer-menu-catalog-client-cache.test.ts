import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isCustomerMenuCatalogUnchanged,
  parseCustomerMenuCatalogApiBody,
} from './customer-menu-catalog-client-cache.ts';

describe('parseCustomerMenuCatalogApiBody', () => {
  it('parses unchanged envelope', () => {
    const body = parseCustomerMenuCatalogApiBody({ version: 3, unchanged: true });
    assert.equal(isCustomerMenuCatalogUnchanged(body), true);
    assert.equal(body.version, 3);
  });

  it('parses full catalog envelope', () => {
    const body = parseCustomerMenuCatalogApiBody({
      version: 4,
      menuItems: [],
      menuCategories: [],
    });
    assert.equal(isCustomerMenuCatalogUnchanged(body), false);
    if (isCustomerMenuCatalogUnchanged(body)) throw new Error('expected full');
    assert.equal(body.version, 4);
    assert.deepEqual(body.menuItems, []);
    assert.deepEqual(body.menuCategories, []);
  });

  it('rejects missing version', () => {
    assert.throws(() => parseCustomerMenuCatalogApiBody({ menuItems: [], menuCategories: [] }));
  });
});
