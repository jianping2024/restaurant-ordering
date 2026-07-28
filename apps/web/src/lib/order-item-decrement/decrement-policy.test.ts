import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canDecrementOrderLine,
  menuDecrementAllowedFromCaps,
} from './decrement-policy';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import type { OrderItem } from '@/types';

function menuItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'i1',
    name: 'Sushi',
    price: 10,
    qty: 1,
    item_status: 'pending',
    ...overrides,
  } as OrderItem;
}

describe('menuDecrementAllowedFromCaps', () => {
  it('requires orders.menu_decrement', () => {
    assert.equal(menuDecrementAllowedFromCaps('*'), true);
    assert.equal(
      menuDecrementAllowedFromCaps(capabilitiesFromKeys(['orders.menu_decrement'])),
      true,
    );
    assert.equal(menuDecrementAllowedFromCaps(capabilitiesFromKeys(['orders.edit'])), false);
  });
});

describe('canDecrementOrderLine', () => {
  it('blocks without capability', () => {
    assert.equal(
      canDecrementOrderLine(capabilitiesFromKeys([]), menuItem(), 'pending'),
      false,
    );
  });

  it('allows pending menu lines with capability', () => {
    const caps = capabilitiesFromKeys(['orders.menu_decrement']);
    assert.equal(canDecrementOrderLine(caps, menuItem(), 'pending'), true);
    assert.equal(
      canDecrementOrderLine(caps, menuItem({ kind: 'buffet_base' } as Partial<OrderItem>), 'pending'),
      false,
    );
  });
});
