import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OrderItem } from '@/types';
import {
  formatMenuPrintDisplayName,
  formatStationSlipItemLabel,
  formatTopCategoryTicketHeader,
  menuLocalizedName,
  orderItemReceiptLineLabel,
  orderItemStationPrintNames,
  orderItemStationSlipLabel,
  stationTicketLineNames,
} from './menu-print-label';

const triItem: OrderItem = {
  id: 'menu-1',
  name: 'Água 500ml',
  name_pt: 'Água 500ml',
  name_en: 'Water 500ml',
  name_zh: '矿泉水 500ml',
  qty: 1,
  price: 1.85,
  emoji: '💧',
  item_code: '001',
  category_code_path: ['RE'],
};

describe('menuLocalizedName', () => {
  it('picks name by print locale with fallbacks', () => {
    assert.equal(menuLocalizedName(triItem, 'zh'), '矿泉水 500ml');
    assert.equal(menuLocalizedName(triItem, 'en'), 'Water 500ml');
    assert.equal(menuLocalizedName(triItem, 'pt'), 'Água 500ml');
    assert.equal(
      menuLocalizedName({ name_pt: 'Água', name_en: null, name_zh: null }, 'zh'),
      'Água',
    );
  });
});

describe('orderItemReceiptLineLabel', () => {
  it('uses item code and localized name (no category path)', () => {
    assert.equal(orderItemReceiptLineLabel(triItem, 'pt'), '001-Água 500ml');
    assert.equal(orderItemReceiptLineLabel(triItem, 'zh'), '001-矿泉水 500ml');
  });

  it('prints buffet base name only when no codes', () => {
    const item: OrderItem = {
      id: 'buffet:abc',
      kind: 'buffet_base',
      name: 'Buffet livre',
      name_pt: 'Buffet livre',
      name_zh: '自助餐',
      qty: 1,
      price: 127.7,
      emoji: '🍽️',
    };
    assert.equal(orderItemReceiptLineLabel(item, 'pt'), 'Buffet livre');
    assert.equal(orderItemReceiptLineLabel(item, 'zh'), '自助餐');
  });
});

describe('orderItemStationSlipLabel', () => {
  it('uses item code and localized name only', () => {
    assert.equal(orderItemStationSlipLabel(triItem, 'en'), '001-Water 500ml');
  });
});

describe('formatStationSlipItemLabel', () => {
  it('joins code and trimmed name', () => {
    assert.equal(
      formatStationSlipItemLabel({ itemCode: '102', itemName: 'MOJITO CLASSIC' }),
      '102-MOJITO CLASSIC',
    );
  });
});

describe('formatTopCategoryTicketHeader', () => {
  it('uses single localized category name plus optional code', () => {
    assert.equal(
      formatTopCategoryTicketHeader(
        {
          item_code: '2',
          name_pt: 'Bebidas',
          name_en: 'Drinks',
          name_zh: '饮料',
        },
        'pt',
      ),
      '(Bebidas2)',
    );
    assert.equal(
      formatTopCategoryTicketHeader(
        {
          item_code: '2',
          name_pt: 'Bebidas',
          name_en: 'Drinks',
          name_zh: '饮料',
        },
        'zh',
      ),
      '(饮料2)',
    );
  });
});

describe('formatMenuPrintDisplayName', () => {
  it('joins multi-level category codes', () => {
    assert.equal(
      formatMenuPrintDisplayName({
        categoryPath: ['A01', 'B02'],
        itemCode: '007',
        itemName: 'Soup',
      }),
      'A01-B02-007-Soup',
    );
  });
});

describe('orderItemStationPrintNames', () => {
  it('legacy snapshot (no flags) keeps the single print_locale name', () => {
    assert.deepEqual(orderItemStationPrintNames(triItem, 'pt'), ['Água 500ml']);
    assert.deepEqual(orderItemStationPrintNames(triItem, 'zh'), ['矿泉水 500ml']);
  });

  it('expands ticked names in fixed pt → en → zh order', () => {
    const item = { ...triItem, station_print_pt: true, station_print_en: false, station_print_zh: true };
    assert.deepEqual(orderItemStationPrintNames(item, 'zh'), ['Água 500ml', '矿泉水 500ml']);
    const all = { ...triItem, station_print_pt: true, station_print_en: true, station_print_zh: true };
    assert.deepEqual(orderItemStationPrintNames(all, 'pt'), ['Água 500ml', 'Water 500ml', '矿泉水 500ml']);
  });

  it('skips ticked but empty names', () => {
    const item = { ...triItem, name_zh: '  ', station_print_pt: true, station_print_zh: true };
    assert.deepEqual(orderItemStationPrintNames(item, 'pt'), ['Água 500ml']);
  });

  it('nothing ticked falls back to the print_locale name', () => {
    const item = { ...triItem, station_print_pt: false, station_print_en: false, station_print_zh: false };
    assert.deepEqual(orderItemStationPrintNames(item, 'pt'), ['Água 500ml']);
  });

  it('collapses control characters and inner newlines to one space', () => {
    const item = { ...triItem, name_zh: '矿泉水\n500ml\t', station_print_pt: false, station_print_zh: true };
    assert.deepEqual(orderItemStationPrintNames(item, 'pt'), ['矿泉水 500ml']);
  });
});

describe('stationTicketLineNames', () => {
  it('first name drives item_name / display_name; print_names has no code', () => {
    const item = { ...triItem, station_print_pt: true, station_print_zh: true };
    assert.deepEqual(stationTicketLineNames(item, 'pt'), {
      item_code: '001',
      item_name: 'Água 500ml',
      display_name: '001-Água 500ml',
      print_names: ['Água 500ml', '矿泉水 500ml'],
    });
  });

  it('legacy line matches the pre-multilang label', () => {
    const line = stationTicketLineNames(triItem, 'zh');
    assert.equal(line.display_name, orderItemStationSlipLabel(triItem, 'zh'));
    assert.deepEqual(line.print_names, ['矿泉水 500ml']);
  });
});
