import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OrderItem } from '@/types';
import {
  formatMenuPrintDisplayName,
  formatStationSlipItemLabel,
  formatTopCategoryTicketHeader,
  orderItemReceiptLineLabel,
  orderItemStationSlipLabel,
} from './menu-print-label';

describe('orderItemReceiptLineLabel', () => {
  it('formats category path, item code, and name from order snapshot', () => {
    const item: OrderItem = {
      id: 'menu-1',
      name: 'Água 500ml',
      name_pt: 'Água 500ml',
      qty: 1,
      price: 1.85,
      emoji: '💧',
      item_code: '001',
      category_code_path: ['RE'],
    };
    assert.equal(orderItemReceiptLineLabel(item), 'RE-001-Água 500ml');
  });

  it('prints buffet base name only when no codes', () => {
    const item: OrderItem = {
      id: 'buffet:abc',
      kind: 'buffet_base',
      name: 'Buffet livre',
      name_pt: 'Buffet livre',
      qty: 1,
      price: 127.7,
      emoji: '🍽️',
    };
    assert.equal(orderItemReceiptLineLabel(item), 'Buffet livre');
  });
});

describe('orderItemStationSlipLabel', () => {
  it('uses item code and name only (no category path)', () => {
    const item: OrderItem = {
      id: 'menu-1',
      name: 'Água 500ml',
      name_pt: 'Água 500ml',
      qty: 1,
      price: 1.85,
      emoji: '💧',
      item_code: '001',
      category_code_path: ['A'],
    };
    assert.equal(orderItemStationSlipLabel(item), '001-Água 500ml');
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
  it('appends top-level category code after bilingual names', () => {
    assert.equal(
      formatTopCategoryTicketHeader(
        {
          item_code: '2',
          name_pt: 'Bebidas',
          name_en: 'Drinks',
        },
        'pt',
      ),
      '(Bebidas/ Drinks2)',
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
