import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBuffetUpdatePatch } from '@/lib/buffet-update-patch';

describe('parseBuffetUpdatePatch', () => {
  it('keeps only whitelisted, type-checked fields', () => {
    assert.deepEqual(parseBuffetUpdatePatch({ name: ' Lunch ', is_active: false }), {
      ok: true,
      patch: { name: 'Lunch', is_active: false },
    });
    assert.deepEqual(parseBuffetUpdatePatch({ vat_rate: 13, description: '  ' }), {
      ok: true,
      patch: { vat_rate: 13, description: null },
    });
  });

  it('rejects cross-tenant / unknown keys', () => {
    for (const raw of [
      { restaurant_id: 'other-restaurant' },
      { name: 'x', restaurant_id: 'other-restaurant' },
      { id: 'b2' },
      { created_at: '2020-01-01' },
    ]) {
      assert.deepEqual(parseBuffetUpdatePatch(raw), { error: 'invalid_buffet_patch', status: 400 });
    }
  });

  it('rejects wrong types and empty bodies', () => {
    assert.deepEqual(parseBuffetUpdatePatch({ is_active: 'yes' }), { error: 'invalid_buffet_patch', status: 400 });
    assert.deepEqual(parseBuffetUpdatePatch({ vat_rate: '13' }), { error: 'invalid_vat_rate', status: 400 });
    assert.deepEqual(parseBuffetUpdatePatch({ vat_rate: 7 }), { error: 'invalid_vat_rate', status: 400 });
    assert.deepEqual(parseBuffetUpdatePatch({ name: '' }), { error: 'name_required', status: 400 });
    assert.deepEqual(parseBuffetUpdatePatch({ description: 5 }), { error: 'invalid_buffet_patch', status: 400 });
    assert.deepEqual(parseBuffetUpdatePatch({}), { error: 'invalid_buffet_patch', status: 400 });
    assert.deepEqual(parseBuffetUpdatePatch(null), { error: 'invalid_buffet_patch', status: 400 });
    assert.deepEqual(parseBuffetUpdatePatch([]), { error: 'invalid_buffet_patch', status: 400 });
  });
});
