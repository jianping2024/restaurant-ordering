import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkReadyHealth, liveHealthBody } from './ops-health.ts';
import { getWebAppBuildInfo } from './web-app-build.ts';

describe('ops-health', () => {
  it('liveHealthBody is ok/live with version from getWebAppBuildInfo', () => {
    const body = liveHealthBody();
    assert.equal(body.ok, true);
    assert.equal(body.status, 'live');
    assert.equal(body.version, getWebAppBuildInfo().version);
  });

  it('checkReadyHealth returns 503 when service role key is missing', async () => {
    const prev = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const result = await checkReadyHealth();
      assert.equal(result.httpStatus, 503);
      assert.equal(result.body.ok, false);
      assert.equal(result.body.status, 'ready');
      assert.equal('version' in result.body, false);
    } finally {
      if (prev === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = prev;
    }
  });
});
