import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canDecrementOrderLine,
  menuDecrementAllowedFor,
  resolveMenuDecrementOperator,
} from '@/lib/order-item-decrement/decrement-policy';
import type { OrderItem } from '@/types';

const menuItem = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  id: 'item-1',
  name: 'Cola',
  name_pt: 'Cola',
  qty: 2,
  price: 2.5,
  emoji: '🥤',
  item_status: 'pending',
  ...overrides,
});

describe('resolveMenuDecrementOperator', () => {
  it('maps owner, frontdesk, and waiter surfaces', () => {
    assert.equal(resolveMenuDecrementOperator({ role: 'waiter', asOwner: true }), 'owner');
    assert.equal(resolveMenuDecrementOperator({ role: 'frontdesk' }), 'frontdesk_staff');
    assert.equal(
      resolveMenuDecrementOperator({ role: 'waiter', embeddedInDashboard: true }),
      'frontdesk_staff',
    );
    assert.equal(resolveMenuDecrementOperator({ role: 'waiter' }), 'waiter_staff');
  });
});

describe('menuDecrementAllowedFor', () => {
  it('allows frontdesk and owner only', () => {
    assert.equal(menuDecrementAllowedFor('frontdesk_staff'), true);
    assert.equal(menuDecrementAllowedFor('owner'), true);
    assert.equal(menuDecrementAllowedFor('waiter_staff'), false);
  });
});

describe('canDecrementOrderLine', () => {
  it('denies waiter on all menu lines regardless of item type', () => {
    assert.equal(canDecrementOrderLine('waiter_staff', menuItem(), 'pending'), false);
    assert.equal(
      canDecrementOrderLine('waiter_staff', menuItem({ item_status: 'cooking' }), 'cooking'),
      false,
    );
  });

  it('allows frontdesk on decrementable menu lines', () => {
    assert.equal(canDecrementOrderLine('frontdesk_staff', menuItem(), 'pending'), true);
    assert.equal(canDecrementOrderLine('frontdesk_staff', menuItem({ kind: 'buffet_base' }), 'pending'), false);
  });
});
