import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mapMenuCategoryApiError,
  mapMenuItemApiError,
} from './dashboard-menu-client';
import {
  parseCategoryBody,
  parseCategoryParentId,
  parseMenuItemBody,
  parsePrintStationBody,
} from './dashboard-menu-server';

const categoryLabels = {
  errCategoryCodeRequired: 'code required',
  errCategoryCodeDuplicate: 'code duplicate',
  ptNameRequired: 'pt required',
  depthExceeded: 'max {max} depth {depth}',
  errMigrateTargetInSubtree: 'migrate invalid',
  saveFail: 'save fail',
};

const itemLabels = {
  errItemCodeRequired: 'item code required',
  errItemCodeDuplicate: 'item code duplicate',
  ptNameRequired: 'pt required',
  validPrice: 'invalid price',
  vatRateRequired: 'vat required',
  categoryRequired: 'category required',
  imageTypeInvalid: 'bad image',
  dishReorderScopeMismatch: 'scope mismatch',
  saveFail: 'save fail',
};

describe('parseCategoryBody', () => {
  it('accepts valid category fields', () => {
    const parsed = parseCategoryBody({
      name_pt: 'Bebidas',
      name_en: 'Drinks',
      item_code: 'A01',
      print_station_id: 'station-1',
    });
    assert.ok(!('error' in parsed));
    if ('error' in parsed) return;
    assert.equal(parsed.name_pt, 'Bebidas');
    assert.equal(parsed.name_en, 'Drinks');
    assert.equal(parsed.name_zh, null);
    assert.equal(parsed.item_code, 'A01');
    assert.equal(parsed.print_station_id, 'station-1');
  });

  it('rejects missing required fields', () => {
    const parsed = parseCategoryBody({ name_pt: 'Only PT' });
    assert.equal('error' in parsed, true);
    if (!('error' in parsed)) return;
    assert.equal(parsed.error, 'invalid_category_body');
  });
});

describe('parseCategoryParentId', () => {
  it('treats absent parent as top-level', () => {
    assert.equal(parseCategoryParentId({}), null);
    assert.equal(parseCategoryParentId({ parent_id: null }), null);
  });

  it('accepts string parent id', () => {
    assert.equal(parseCategoryParentId({ parent_id: 'parent-uuid' }), 'parent-uuid');
  });

  it('rejects invalid parent id', () => {
    const parsed = parseCategoryParentId({ parent_id: 42 });
    assert.ok(parsed && typeof parsed === 'object' && 'error' in parsed);
    if (!parsed || typeof parsed !== 'object' || !('error' in parsed)) return;
    assert.equal(parsed.error, 'invalid_parent_id');
  });
});

describe('parsePrintStationBody', () => {
  it('accepts valid station fields', () => {
    const parsed = parsePrintStationBody({
      name_pt: 'Cozinha',
      ticket_layout: 'kitchen',
    });
    assert.ok(!('error' in parsed));
    if ('error' in parsed) return;
    assert.equal(parsed.ticket_layout, 'kitchen');
  });

  it('rejects unknown layout', () => {
    const parsed = parsePrintStationBody({
      name_pt: 'Cozinha',
      ticket_layout: 'unknown',
    });
    assert.equal('error' in parsed, true);
    if (!('error' in parsed)) return;
    assert.equal(parsed.error, 'invalid_ticket_layout');
  });
});

describe('parseMenuItemBody', () => {
  it('accepts valid item fields', () => {
    const parsed = parseMenuItemBody({
      name_pt: 'Bacalhau',
      category_id: 'cat-1',
      item_code: 'D01',
      price: 12.5,
      vat_rate: '6',
      emoji: '🐟',
      note_preset_keys: ['no_onion'],
      available: true,
    });
    assert.ok(!('error' in parsed));
    if ('error' in parsed) return;
    assert.equal(parsed.price, 12.5);
    assert.equal(parsed.vat_rate, 6);
    assert.deepEqual(parsed.note_preset_keys, ['no_onion']);
  });

  it('rejects invalid vat rate', () => {
    const parsed = parseMenuItemBody({
      name_pt: 'Bacalhau',
      category_id: 'cat-1',
      item_code: 'D01',
      price: 12.5,
      vat_rate: 'bad',
      emoji: '🐟',
      note_preset_keys: [],
    });
    assert.equal('error' in parsed, true);
    if (!('error' in parsed)) return;
    assert.equal(parsed.error, 'invalid_vat_rate');
  });
});

describe('mapMenuCategoryApiError', () => {
  it('maps known API codes to labels', () => {
    assert.equal(
      mapMenuCategoryApiError('category_code_duplicate', undefined, categoryLabels),
      'code duplicate',
    );
    assert.equal(
      mapMenuCategoryApiError('category_depth_exceeded', undefined, categoryLabels),
      'max 5 depth 5',
    );
  });

  it('falls back to message then saveFail', () => {
    assert.equal(mapMenuCategoryApiError('insert_failed', 'db down', categoryLabels), 'db down');
    assert.equal(mapMenuCategoryApiError('unknown', undefined, categoryLabels), 'save fail');
  });
});

describe('mapMenuItemApiError', () => {
  it('maps known API codes to labels', () => {
    assert.equal(
      mapMenuItemApiError('item_code_duplicate', undefined, itemLabels),
      'item code duplicate',
    );
    assert.equal(mapMenuItemApiError('invalid_image', undefined, itemLabels), 'bad image');
    assert.equal(
      mapMenuItemApiError('reorder_scope_mismatch', undefined, itemLabels),
      'scope mismatch',
    );
  });
});
