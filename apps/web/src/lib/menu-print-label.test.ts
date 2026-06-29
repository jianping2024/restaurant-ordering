import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OrderItem } from '@/types';
import {
  formatMenuPrintDisplayName,
  orderItemReceiptLineLabel,
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
