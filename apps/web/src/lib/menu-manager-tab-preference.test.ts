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
    assert.equal(isMenuManagerTab('recommended'), true);
    assert.equal(isMenuManagerTab('note_presets'), true);
    assert.equal(isMenuManagerTab('choice_groups'), true);
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
    assert.equal(resolveAllowedMenuManagerTab('recommended', false), 'recommended');
  });
});

describe('menuManagerPath', () => {
  it('uses dashboard menu route with optional tab query', () => {
    assert.equal(menuManagerPath('demo', MENU_MANAGER_DEFAULT_TAB), '/dashboard/r/demo/menu');
    assert.equal(menuManagerPath('demo', 'items'), '/dashboard/r/demo/menu?tab=items');
    assert.equal(menuManagerPath('demo', 'note_presets'), '/dashboard/r/demo/menu?tab=note_presets');
    assert.equal(menuManagerPath('demo', 'recommended'), '/dashboard/r/demo/menu?tab=recommended');
    assert.equal(menuManagerTabQuery('categories'), '?tab=categories');
  });
});
