import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isPrintAgentDeviceActiveInDb } from '@mesa/shared';

const DEVICE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RESTAURANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function mockDeviceAdmin(row: { revoked_at: string | null; valid_until: string } | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error: null }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('isPrintAgentDeviceActiveInDb', () => {
  it('returns true for active device', async () => {
    const ok = await isPrintAgentDeviceActiveInDb(
      mockDeviceAdmin({
        revoked_at: null,
        valid_until: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      DEVICE_ID,
      RESTAURANT_ID,
    );
    assert.equal(ok, true);
  });

  it('returns false when revoked', async () => {
    const ok = await isPrintAgentDeviceActiveInDb(
      mockDeviceAdmin({
        revoked_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      DEVICE_ID,
      RESTAURANT_ID,
    );
    assert.equal(ok, false);
  });

  it('returns false when expired', async () => {
    const ok = await isPrintAgentDeviceActiveInDb(
      mockDeviceAdmin({
        revoked_at: null,
        valid_until: new Date(Date.now() - 86_400_000).toISOString(),
      }),
      DEVICE_ID,
      RESTAURANT_ID,
    );
    assert.equal(ok, false);
  });

  it('returns false when row missing', async () => {
    const ok = await isPrintAgentDeviceActiveInDb(mockDeviceAdmin(null), DEVICE_ID, RESTAURANT_ID);
    assert.equal(ok, false);
  });
});
