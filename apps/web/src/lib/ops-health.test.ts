import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkReadyHealth, liveHealthBody } from './ops-health.ts';

describe('ops-health', () => {
  it('liveHealthBody is a fixed ok/live contract', () => {
    assert.deepEqual(liveHealthBody(), { ok: true, status: 'live' });
  });

  it('checkReadyHealth returns 503 when service role key is missing', async () => {
    const prev = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const result = await checkReadyHealth();
      assert.equal(result.httpStatus, 503);
      assert.equal(result.body.ok, false);
      assert.equal(result.body.status, 'ready');
    } finally {
      if (prev === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = prev;
    }
  });
});
