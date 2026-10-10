import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  messageForCheckoutErrorOverrides,
  messageForCheckoutRequestError,
} from './checkout-request-error-message';

const labels = {
  guestCountRequired: 'GUEST',
  partyMergeRequired: 'PARTY',
  emptySession: 'EMPTY',
  noActiveSession: 'NO_SESSION',
  tableNotAvailable: 'NO_TABLE',
  invalidNif: 'NIF',
  splitPlanLocked: 'LOCKED',
  fallback: 'FALLBACK',
};

describe('messageForCheckoutRequestError', () => {
  it('maps known server and client codes to explicit labels', () => {
    assert.equal(messageForCheckoutRequestError('guest_count_required', labels), 'GUEST');
    assert.equal(messageForCheckoutRequestError('party_merge_required', labels), 'PARTY');
    assert.equal(messageForCheckoutRequestError('empty_session', labels), 'EMPTY');
    assert.equal(messageForCheckoutRequestError('no_active_session', labels), 'NO_SESSION');
    assert.equal(messageForCheckoutRequestError('table_not_available', labels), 'NO_TABLE');
    assert.equal(messageForCheckoutRequestError('invalid_nif', labels), 'NIF');
    assert.equal(messageForCheckoutRequestError('split_mode_locked', labels), 'LOCKED');
    assert.equal(messageForCheckoutRequestError('locked_allocation_changed', labels), 'LOCKED');
    assert.equal(messageForCheckoutRequestError('split_shape_locked', labels), 'LOCKED');
  });

  it('maps by_item_unit_mismatch to its slot and fills the rejected dish', () => {
    const withUnit = { ...labels, individualUnitMismatch: 'Cut of {dish} is fixed' };
    assert.equal(
      messageForCheckoutRequestError('by_item_unit_mismatch', withUnit, undefined, { dish: 'Mojito' }),
      'Cut of Mojito is fixed',
    );
    assert.equal(
      messageForCheckoutRequestError('by_item_unit_mismatch', withUnit),
      'Cut of {dish} is fixed',
    );
    assert.equal(messageForCheckoutRequestError('by_item_unit_mismatch', labels), 'FALLBACK');
  });

  it('maps by_item_cut_change_at_collect to its staff slot with the dish', () => {
    const withCut = { ...labels, byItemCutChangeAtCollect: 'Cut of {dish} changes at collect' };
    assert.equal(
      messageForCheckoutRequestError('by_item_cut_change_at_collect', withCut, undefined, { dish: 'Mojito' }),
      'Cut of Mojito changes at collect',
    );
  });

  it('uses fallback only for blank network or unknown codes', () => {
    assert.equal(messageForCheckoutRequestError(null, labels), 'FALLBACK');
    assert.equal(messageForCheckoutRequestError('', labels), 'FALLBACK');
    assert.equal(messageForCheckoutRequestError('network_error', labels), 'FALLBACK');
    assert.equal(messageForCheckoutRequestError('checkout_request_failed', labels), 'FALLBACK');
    assert.equal(messageForCheckoutRequestError('upsert_failed', labels), 'FALLBACK');
  });
});

describe('messageForCheckoutRequestError individual refusals', () => {
  const withRefused = { ...labels, individualCallRefused: 'REFUSED' };

  it('maps every ticket-lock / stale-plan code to the explicit copy', () => {
    for (const code of [
      'stale_plan',
      'ticket_locked',
      'locked_ticket_changed',
      'not_your_ticket',
      'ticket_paid',
      'ticket_collecting',
    ]) {
      assert.equal(messageForCheckoutRequestError(code, withRefused), 'REFUSED', code);
    }
  });

  it('keeps a server fault on the fallback', () => {
    assert.equal(messageForCheckoutRequestError('individual_apply_failed', withRefused), 'FALLBACK');
  });
});

describe('messageForCheckoutRequestError split validation + overrides', () => {
  const full = {
    ...labels,
    splitUnassignedItems: 'UNASSIGNED',
    splitIncompleteQty: 'INCOMPLETE',
    splitAmountMismatch: 'MISMATCH',
  };

  it('maps the split validation codes to their copy', () => {
    assert.equal(messageForCheckoutRequestError('unassigned_items', full), 'UNASSIGNED');
    assert.equal(messageForCheckoutRequestError('incomplete_qty', full), 'INCOMPLETE');
    assert.equal(messageForCheckoutRequestError('amount_mismatch', full), 'MISMATCH');
  });

  it('falls back when the surface has no copy for the slot', () => {
    assert.equal(messageForCheckoutRequestError('incomplete_qty', labels), 'FALLBACK');
  });

  it('lets a surface override one code and keeps the rest', () => {
    assert.equal(
      messageForCheckoutRequestError('already_paid', labels, { already_paid: 'PAID' }),
      'PAID',
    );
    assert.equal(messageForCheckoutRequestError('empty_session', labels, { already_paid: 'PAID' }), 'EMPTY');
  });

  it('override-only surfaces use their own fallback for unknown codes', () => {
    assert.equal(messageForCheckoutErrorOverrides('whole_table_paid', { whole_table_paid: 'W' }, 'F'), 'W');
    assert.equal(messageForCheckoutErrorOverrides('nope', { whole_table_paid: 'W' }, 'F'), 'F');
    assert.equal(messageForCheckoutErrorOverrides(null, { whole_table_paid: 'W' }, 'F'), 'F');
  });
});

