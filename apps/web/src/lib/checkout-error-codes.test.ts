import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHECKOUT_ERROR_COPY,
  CHECKOUT_ERROR_STATUS,
  checkoutErrorStatus,
  checkoutFailure,
  isCheckoutErrorCode,
} from './checkout-error-codes';

describe('checkout error registry status', () => {
  // Statuses the four former tables / inline ternaries / route literals answered with.
  const expected: Record<string, number> = {
    bill_split_not_found: 404,
    bill_split_cancelled: 409,
    empty_split: 400,
    invalid_person_index: 400,
    invalid_collected_amount: 400,
    missing_payment_method: 400,
    invalid_payment_method: 400,
    missing_payment_lines: 400,
    invalid_payment_lines: 400,
    payment_lines_amount_mismatch: 400,
    already_paid: 409,
    client_request_id_conflict: 409,
    bill_update_failed: 500,
    session_close_failed: 500,
    invalid_request: 400,
    invalid_ticket: 400,
    empty_ticket: 400,
    no_active_session: 404,
    ticket_not_found: 404,
    not_your_ticket: 403,
    claim_conflict: 409,
    by_item_unit_mismatch: 409,
    name_taken: 409,
    ticket_locked: 409,
    ticket_paid: 409,
    ticket_collecting: 409,
    locked_ticket_changed: 409,
    stale_plan: 409,
    split_mode_locked: 409,
    split_shape_locked: 409,
    locked_allocation_changed: 409,
    no_session: 404,
    whole_table_paid: 409,
    resume_failed: 500,
    unauthorized: 401,
    server_misconfigured: 503,
    staff_only: 403,
  };

  it('keeps the status every migrated code had before', () => {
    for (const [code, status] of Object.entries(expected)) {
      assert.equal(checkoutErrorStatus(code), status, code);
    }
  });

  it('treats an unregistered code as a server fault', () => {
    assert.equal(checkoutErrorStatus('not_a_code'), 500);
    assert.equal(isCheckoutErrorCode('not_a_code'), false);
    assert.equal(isCheckoutErrorCode('stale_plan'), true);
  });

  it('only uses real HTTP error statuses', () => {
    for (const [code, status] of Object.entries(CHECKOUT_ERROR_STATUS)) {
      assert.ok(status >= 400 && status < 600, code);
    }
  });

  it('builds a failure result with the registered status', () => {
    assert.deepEqual(checkoutFailure('no_active_session'), {
      ok: false,
      error: 'no_active_session',
      status: 404,
    });
    assert.equal(checkoutFailure('upsert_failed', { message: 'x' }).message, 'x');
  });

  it('only gives copy slots to registered codes', () => {
    for (const code of Object.keys(CHECKOUT_ERROR_COPY)) {
      assert.ok(isCheckoutErrorCode(code), code);
    }
  });
});
