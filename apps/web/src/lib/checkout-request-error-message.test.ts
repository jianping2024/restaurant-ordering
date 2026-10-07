import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { messageForCheckoutRequestError } from './checkout-request-error-message';

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

