import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isMenuManagerTab,
  MENU_MANAGER_DEFAULT_TAB,
  menuManagerPath,
  menuManagerTabQuery,
} from './menu-manager-tab-preference';

describe('isMenuManagerTab', () => {
  it('accepts known tabs only', () => {
    assert.equal(isMenuManagerTab('stations'), true);
    assert.equal(isMenuManagerTab('categories'), true);
    assert.equal(isMenuManagerTab('items'), true);
    assert.equal(isMenuManagerTab('tables'), false);
    assert.equal(isMenuManagerTab(null), false);
  });
});

describe('menuManagerPath', () => {
  it('uses dashboard menu route with optional tab query', () => {
    assert.equal(menuManagerPath(MENU_MANAGER_DEFAULT_TAB), '/dashboard/menu');
    assert.equal(menuManagerPath('items'), '/dashboard/menu?tab=items');
    assert.equal(menuManagerTabQuery('categories'), '?tab=categories');
  });
});
