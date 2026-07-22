import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SUPPORTED_UI_LANGS } from '../i18n';
import { resolveMenuItemLocalizedName } from '../menu-item-display';
import { formatPreviewCopy, getLandingPreviewCopy } from './preview-copy';
import { PREVIEW_CART_TOTAL, PREVIEW_MENU_ITEMS, getPreviewMenuItem } from './preview-data';

describe('getLandingPreviewCopy', () => {
  it('returns the same shape for every UI language', () => {
    const zh = getLandingPreviewCopy('zh');
    for (const lang of SUPPORTED_UI_LANGS) {
      const copy = getLandingPreviewCopy(lang);
      assert.equal(typeof copy.chrome.banner, 'string');
      assert.equal(typeof copy.shared.restaurantName, 'string');
      assert.equal(copy.bill.splitModes.length, 3);
      assert.equal(typeof copy.menu.categories.drinks, 'string');
      assert.equal(typeof copy.bar.status.pending, 'string');
      assert.ok(copy.shared.tableLabel.includes('{name}'));
      assert.deepEqual(Object.keys(copy).sort(), Object.keys(zh).sort());
    }
  });
});

describe('formatPreviewCopy', () => {
  it('replaces placeholders', () => {
    assert.equal(formatPreviewCopy('Mesa {name}', { name: '8' }), 'Mesa 8');
    assert.equal(
      formatPreviewCopy('{name} ×{qty}', { name: 'Cola', qty: 2 }),
      'Cola ×2',
    );
  });
});

describe('preview-data localization fields', () => {
  it('exposes product-shaped names and a valid cart total', () => {
    const item = getPreviewMenuItem('005');
    assert.ok(item);
    assert.equal(resolveMenuItemLocalizedName(item, 'pt'), 'Sumo Laranja Natural');
    assert.equal(resolveMenuItemLocalizedName(item, 'en'), 'Fresh orange juice');
    assert.equal(resolveMenuItemLocalizedName(item, 'zh'), '鲜榨橙汁');
    assert.ok(PREVIEW_CART_TOTAL > 0);
    assert.ok(
      PREVIEW_MENU_ITEMS.every(
        (row) => row.category === 'drinks' || row.category === 'fruit-wine',
      ),
    );
  });
});
