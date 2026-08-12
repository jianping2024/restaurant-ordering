import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_SUSHI_ROUND_SETTINGS,
  clampSushiPerPersonPerRoundCap,
  clampSushiRoundConfirmTimeoutSeconds,
  clampSushiRoundCooldownSeconds,
  clampSushiRoundDeferCooldownSeconds,
  clampSushiRoundOrderingEnabled,
  parseSushiRoundSettingsFromRestaurantRow,
  parseSushiRoundSettingsPatch,
  sushiRoundSettingsToApiJson,
} from '@/lib/table-order-round/settings';
import { guestClientStorageKey, parseGuestClientId } from '@/lib/table-order-round/guest-client';
import {
  isCooldownActive,
  isDeferCooldownActive,
  roundCapTotal,
} from '@/lib/table-order-round/status';

describe('sushi round settings', () => {
  it('clamps caps and timeouts to bounds', () => {
    assert.equal(clampSushiPerPersonPerRoundCap(0), 1);
    assert.equal(clampSushiPerPersonPerRoundCap(8), 8);
    assert.equal(clampSushiPerPersonPerRoundCap(99), 20);
    assert.equal(clampSushiRoundConfirmTimeoutSeconds(10), 15);
    assert.equal(clampSushiRoundConfirmTimeoutSeconds(25), 25);
    assert.equal(clampSushiRoundConfirmTimeoutSeconds(40), 40);
    assert.equal(clampSushiRoundCooldownSeconds(10), 30);
    assert.equal(clampSushiRoundCooldownSeconds(120), 120);
    assert.equal(clampSushiRoundDeferCooldownSeconds(5), 15);
    assert.equal(clampSushiRoundDeferCooldownSeconds(30), 30);
    assert.equal(clampSushiRoundOrderingEnabled(true), true);
    assert.equal(clampSushiRoundOrderingEnabled(undefined), true);
  });

  it('parses restaurant row and patch', () => {
    assert.deepEqual(parseSushiRoundSettingsFromRestaurantRow(null), DEFAULT_SUSHI_ROUND_SETTINGS);
    const parsed = parseSushiRoundSettingsFromRestaurantRow({
      sushi_round_ordering_enabled: false,
      sushi_per_person_per_round_cap: 10,
      sushi_round_confirm_timeout_seconds: 40,
      sushi_round_cooldown_seconds: 180,
      sushi_round_defer_cooldown_seconds: 45,
    });
    assert.equal(parsed.sushi_round_ordering_enabled, false);
    assert.equal(parsed.sushi_per_person_per_round_cap, 10);
    assert.equal(sushiRoundSettingsToApiJson(parsed).sushiPerPersonPerRoundCap, 10);

    const patchOk = parseSushiRoundSettingsPatch({
      sushiRoundOrderingEnabled: true,
      sushiPerPersonPerRoundCap: 6,
    });
    assert.equal(patchOk.ok, true);
    if (patchOk.ok && patchOk.patch) {
      assert.equal(patchOk.patch.sushi_per_person_per_round_cap, 6);
    }

    const patchBad = parseSushiRoundSettingsPatch({ sushiPerPersonPerRoundCap: 99 });
    assert.equal(patchBad.ok, false);
  });
});

describe('guest client helpers', () => {
  it('builds storage key and parses uuid', () => {
    assert.equal(guestClientStorageKey('r1', 't1'), 'mesa_guest_client_id_r1_t1');
    assert.equal(parseGuestClientId('not-a-uuid'), null);
    assert.equal(
      parseGuestClientId('550e8400-e29b-41d4-a716-446655440000'),
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });
});

describe('round status helpers', () => {
  it('computes cap and cooldown windows', () => {
    assert.equal(roundCapTotal(8, 3), 24);
    assert.equal(roundCapTotal(8, 0), 0);
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(isCooldownActive('cooldown', future), true);
    assert.equal(isCooldownActive('cooldown', past), false);
    assert.equal(isDeferCooldownActive(future), true);
    assert.equal(isDeferCooldownActive(past), false);
  });
});
