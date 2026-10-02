import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUSHI_ROUND_MESSAGES,
  messageForGuestRoundQtyPreview,
  messageForSushiRoundError,
} from './sushi-round-messages';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

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
