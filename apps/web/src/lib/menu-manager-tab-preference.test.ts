import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isMenuManagerTab,
  MENU_MANAGER_DEFAULT_TAB,
  MENU_MANAGER_FALLBACK_TAB,
  menuManagerPath,
  menuManagerTabQuery,
  resolveAllowedMenuManagerTab,
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

describe('resolveAllowedMenuManagerTab', () => {
  it('keeps stations when permitted', () => {
    assert.equal(resolveAllowedMenuManagerTab('stations', true), 'stations');
    assert.equal(resolveAllowedMenuManagerTab(undefined, true), MENU_MANAGER_DEFAULT_TAB);
  });

  it('falls back when stations not permitted', () => {
    assert.equal(resolveAllowedMenuManagerTab('stations', false), MENU_MANAGER_FALLBACK_TAB);
    assert.equal(resolveAllowedMenuManagerTab(undefined, false), MENU_MANAGER_FALLBACK_TAB);
    assert.equal(resolveAllowedMenuManagerTab('items', false), 'items');
  });
});

describe('menuManagerPath', () => {
  it('uses dashboard menu route with optional tab query', () => {
    assert.equal(menuManagerPath(MENU_MANAGER_DEFAULT_TAB), '/dashboard/menu');
    assert.equal(menuManagerPath('items'), '/dashboard/menu?tab=items');
    assert.equal(menuManagerTabQuery('categories'), '?tab=categories');
  });
});
