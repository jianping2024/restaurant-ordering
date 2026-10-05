import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUSHI_ROUND_MESSAGES,
  resolveSushiStickyStatusFragment,
  messageForGuestRoundQtyPreview,
  messageForSushiRoundError,
} from './sushi-round-messages';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

describe('resolveSushiStickyStatusFragment', () => {
  const zh = SUSHI_ROUND_MESSAGES.zh;
  const en = SUSHI_ROUND_MESSAGES.en;
  const pt = SUSHI_ROUND_MESSAGES.pt;
  const nowMs = Date.parse('2026-10-05T12:00:00.000Z');

  it('shows short max-per-round hint when idle empty basket', () => {
    assert.deepEqual(
      resolveSushiStickyStatusFragment({
        status: 'collecting',
        cooldownUntil: null,
        submitDeadlineAt: null,
        linesQtyTotal: 0,
        roundCapTotal: 40,
        labels: zh,
        nowMs,
      }),
      { kind: 'limit', text: '每轮最多 40' },
    );
    assert.equal(
      resolveSushiStickyStatusFragment({
        status: null,
        cooldownUntil: null,
        submitDeadlineAt: null,
        linesQtyTotal: 0,
        roundCapTotal: 40,
        labels: en,
        nowMs,
      })?.text,
      'max 40',
    );
    assert.equal(
      resolveSushiStickyStatusFragment({
        status: null,
        cooldownUntil: null,
        submitDeadlineAt: null,
        linesQtyTotal: 0,
        roundCapTotal: 40,
        labels: pt,
        nowMs,
      })?.text,
      'máx. 40',
    );
  });

  it('shows qty/cap progress when basket has qty', () => {
    assert.deepEqual(
      resolveSushiStickyStatusFragment({
        status: 'collecting',
        cooldownUntil: null,
        submitDeadlineAt: null,
        linesQtyTotal: 8,
        roundCapTotal: 40,
        labels: zh,
        nowMs,
      }),
      { kind: 'limit', text: '8/40' },
    );
  });

  it('returns null when cap is not positive', () => {
    assert.equal(
      resolveSushiStickyStatusFragment({
        status: 'collecting',
        cooldownUntil: null,
        submitDeadlineAt: null,
        linesQtyTotal: 3,
        roundCapTotal: 0,
        labels: zh,
        nowMs,
      }),
      null,
    );
  });

  it('pending_confirm wins over limit and uses short sticky copy', () => {
    const deadline = new Date(nowMs + 45_000).toISOString();
    assert.deepEqual(
      resolveSushiStickyStatusFragment({
        status: 'pending_confirm',
        cooldownUntil: null,
        submitDeadlineAt: deadline,
        linesQtyTotal: 8,
        roundCapTotal: 40,
        labels: zh,
        nowMs,
      }),
      { kind: 'pending', text: '45s 后送厨' },
    );
  });

  it('active cooldown wins over limit and hides limit on same slot', () => {
    const until = new Date(nowMs + 12_000).toISOString();
    assert.deepEqual(
      resolveSushiStickyStatusFragment({
        status: 'cooldown',
        cooldownUntil: until,
        submitDeadlineAt: null,
        linesQtyTotal: 0,
        roundCapTotal: 40,
        labels: zh,
        nowMs,
      }),
      { kind: 'cooldown', text: '冷却 12s' },
    );
    assert.equal(
      resolveSushiStickyStatusFragment({
        status: 'cooldown',
        cooldownUntil: until,
        submitDeadlineAt: null,
        linesQtyTotal: 0,
        roundCapTotal: 40,
        labels: en,
        nowMs,
      })?.text,
      'wait 12s',
    );
  });

  it('expired cooldown falls back to limit slot', () => {
    const until = new Date(nowMs - 1_000).toISOString();
    assert.deepEqual(
      resolveSushiStickyStatusFragment({
        status: 'cooldown',
        cooldownUntil: until,
        submitDeadlineAt: null,
        linesQtyTotal: 0,
        roundCapTotal: 40,
        labels: zh,
        nowMs,
      }),
      { kind: 'limit', text: '每轮最多 40' },
    );
  });
});

describe('messageForSushiRoundError', () => {
  const zh = SUSHI_ROUND_MESSAGES.zh;

  it('maps guest_count_required to staff headcount copy', () => {
    assert.equal(
      messageForSushiRoundError('guest_count_required', zh),
      '请先让服务员登记用餐人数',
    );
  });

  it('interpolates used/cap for round_cap_exceeded', () => {
    const msg = messageForSushiRoundError('round_cap_exceeded', zh, {
      used: 16,
      cap: 16,
    });
    assert.match(msg, /16\/16/);
    assert.match(msg, /本轮核单/);
    assert.doesNotMatch(msg, /\{used\}|\{cap\}/);
  });
});

describe('messageForGuestRoundQtyPreview', () => {
  it('routes round_cap and meal errors through one copy helper', () => {
    const cap = messageForGuestRoundQtyPreview(
      { ok: false, error: 'round_cap_exceeded', used: 17, cap: 16 },
      SUSHI_ROUND_MESSAGES.zh,
      MENU_PAGE_MESSAGES.zh,
    );
    assert.match(cap, /17\/16/);
    const meal = messageForGuestRoundQtyPreview(
      { ok: false, error: 'per_person_limit_exceeded' },
      SUSHI_ROUND_MESSAGES.zh,
      MENU_PAGE_MESSAGES.zh,
    );
    assert.equal(meal, MENU_PAGE_MESSAGES.zh.perPersonLimitReached);
  });
});
