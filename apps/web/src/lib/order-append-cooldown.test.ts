import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkOrderAppendCooldown } from './order-append-cooldown';
import type { OrderItem } from '@/types';

describe('order-append-cooldown', () => {
  const nowMs = 1_700_000_000_000;

  it('excludes buffet_base items when picking last menu added_at', () => {
    const buffetItem = {
      kind: 'buffet_base',
      added_at: new Date(nowMs - 10_000).toISOString(),
    } as unknown as OrderItem;
    const menuItem = {
      added_at: new Date(nowMs - 1_000).toISOString(),
    } as unknown as OrderItem;

    const result = checkOrderAppendCooldown({
      nowMs,
      cooldownSeconds: 5,
      sessionOrders: [{ items: [buffetItem, menuItem] }],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      // elapsed=1s, remaining=4s => ceil(4s)=4
      assert.equal(result.retryAfterSec, 4);
    }
  });

  it('allows when elapsed equals cooldown boundary', () => {
    const menuItem = {
      added_at: new Date(nowMs - 5_000).toISOString(),
    } as unknown as OrderItem;

    const result = checkOrderAppendCooldown({
      nowMs,
      cooldownSeconds: 5,
      sessionOrders: [{ items: [menuItem] }],
    });

    assert.equal(result.ok, true);
  });

  it('rejects when elapsed is inside cooldown window', () => {
    const menuItem = {
      added_at: new Date(nowMs - 4_999).toISOString(),
    } as unknown as OrderItem;

    const result = checkOrderAppendCooldown({
      nowMs,
      cooldownSeconds: 5,
      sessionOrders: [{ items: [menuItem] }],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      // remaining=1ms => ceil(0.001s)=1 (guarded to >=1)
      assert.equal(result.retryAfterSec, 1);
    }
  });

  it('allows when no menu item added_at is present', () => {
    const buffetItem = {
      kind: 'buffet_base',
      added_at: new Date(nowMs - 1_000).toISOString(),
    } as unknown as OrderItem;

    const result = checkOrderAppendCooldown({
      nowMs,
      cooldownSeconds: 5,
      sessionOrders: [{ items: [buffetItem] }],
    });

    assert.equal(result.ok, true);
  });
});

