import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  interpretCloseTableSessionResponse,
  parseCloseConfirmFromBody,
} from './close-table-session-ui';

describe('interpretCloseTableSessionResponse', () => {
  it('maps 200 to success', () => {
    assert.deepEqual(interpretCloseTableSessionResponse(200, { ok: true }), { action: 'success' });
  });

  it('maps 404 to no_session', () => {
    assert.deepEqual(interpretCloseTableSessionResponse(404, { error: 'no_session' }), {
      action: 'no_session',
    });
  });

  it('maps close_confirm_required to confirm_close', () => {
    assert.deepEqual(
      interpretCloseTableSessionResponse(409, { error: 'close_confirm_required' }),
      { action: 'confirm_close' },
    );
  });

  it('maps legacy checkout_confirm_required to confirm_close', () => {
    assert.deepEqual(
      interpretCloseTableSessionResponse(409, { error: 'checkout_confirm_required' }),
      { action: 'confirm_close' },
    );
  });

  it('maps other failures to error', () => {
    assert.deepEqual(interpretCloseTableSessionResponse(500, { error: 'update_failed' }), {
      action: 'error',
    });
  });
});

describe('parseCloseConfirmFromBody', () => {
  it('reads confirm_close or confirm_checkout_close', () => {
    assert.equal(parseCloseConfirmFromBody({ confirm_close: true }), true);
    assert.equal(parseCloseConfirmFromBody({ confirm_checkout_close: true }), true);
    assert.equal(parseCloseConfirmFromBody({}), false);
  });
});
