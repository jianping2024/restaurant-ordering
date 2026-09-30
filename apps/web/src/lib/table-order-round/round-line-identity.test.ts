import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeRoundLineNote,
  resolveRoundLineUpsertPlan,
  roundLineIdentityKey,
} from './round-line-identity';

describe('round line identity', () => {
  it('treats trimmed notes as the same identity', () => {
    assert.equal(
      roundLineIdentityKey({ menuItemId: 'a', guestClientId: 'g', note: '  no wasabi  ' }),
      roundLineIdentityKey({ menuItemId: 'a', guestClientId: 'g', note: 'no wasabi' }),
    );
    assert.equal(normalizeRoundLineNote('  x  '), 'x');
  });

  it('keeps different notes as different identities', () => {
    assert.notEqual(
      roundLineIdentityKey({ menuItemId: 'a', guestClientId: 'g', note: 'a' }),
      roundLineIdentityKey({ menuItemId: 'a', guestClientId: 'g', note: 'b' }),
    );
  });

  it('add mode accumulates onto the matching note line only', () => {
    const plan = resolveRoundLineUpsertPlan({
      existingLines: [
        { menu_item_id: 'dish', guest_client_id: 'g', note: 'soft', qty: 2 },
        { menu_item_id: 'dish', guest_client_id: 'g', note: 'hard', qty: 3 },
        { menu_item_id: 'other', guest_client_id: 'g', note: '', qty: 1 },
      ],
      menuItemId: 'dish',
      guestClientId: 'g',
      note: 'soft',
      qty: 2,
      qtyMode: 'add',
    });
    assert.equal(plan.nextQty, 4);
    assert.equal(plan.otherQty, 4);
    assert.equal(plan.note, 'soft');
  });

  it('set mode replaces absolute qty and excludes only that identity from cap others', () => {
    const plan = resolveRoundLineUpsertPlan({
      existingLines: [
        { menu_item_id: 'dish', guest_client_id: 'g', note: 'soft', qty: 2 },
        { menu_item_id: 'dish', guest_client_id: 'g', note: 'hard', qty: 5 },
      ],
      menuItemId: 'dish',
      guestClientId: 'g',
      note: 'soft',
      qty: 1,
      qtyMode: 'set',
    });
    assert.equal(plan.nextQty, 1);
    assert.equal(plan.otherQty, 5);
  });
});
