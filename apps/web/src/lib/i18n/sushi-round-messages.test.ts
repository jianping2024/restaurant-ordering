import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUSHI_ROUND_MESSAGES,
  formatSushiStickyRoundLimit,
  formatSushiSendGuidanceMessage,
  resolveSushiCartSubmitLabel,
  messageForGuestRoundQtyPreview,
  messageForSushiRoundError,
} from './sushi-round-messages';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

describe('formatSushiStickyRoundLimit', () => {
  const zh = SUSHI_ROUND_MESSAGES.zh;
  const en = SUSHI_ROUND_MESSAGES.en;
  const pt = SUSHI_ROUND_MESSAGES.pt;

  it('shows short max-per-round hint when the round is empty', () => {
    assert.equal(formatSushiStickyRoundLimit({ linesQtyTotal: 0, roundCapTotal: 40, labels: zh }), '每轮最多 40');
    assert.equal(formatSushiStickyRoundLimit({ linesQtyTotal: 0, roundCapTotal: 40, labels: en }), 'max 40');
    assert.equal(formatSushiStickyRoundLimit({ linesQtyTotal: 0, roundCapTotal: 40, labels: pt }), 'máx. 40');
  });

  it('labels qty/cap as this round when the round has qty', () => {
    assert.equal(formatSushiStickyRoundLimit({ linesQtyTotal: 8, roundCapTotal: 40, labels: zh }), '本轮 8/40');
    assert.equal(formatSushiStickyRoundLimit({ linesQtyTotal: 8, roundCapTotal: 40, labels: en }), 'round 8/40');
  });

  it('returns null when cap is not positive', () => {
    assert.equal(formatSushiStickyRoundLimit({ linesQtyTotal: 3, roundCapTotal: 0, labels: zh }), null);
  });
});

describe('formatSushiSendGuidanceMessage', () => {
  const zh = SUSHI_ROUND_MESSAGES.zh;

  it('tells the table the kitchen has not got unsent dishes', () => {
    assert.equal(
      formatSushiSendGuidanceMessage({ kind: 'unsent', qty: 3, full: false, cap: 5 }, zh),
      '本桌 3 道菜，厨房还没收到',
    );
    assert.equal(
      formatSushiSendGuidanceMessage({ kind: 'unsent', qty: 5, full: true, cap: 5 }, zh),
      '本轮已满 5/5，先送厨再点',
    );
  });

  it('covers countdown, failed and sent', () => {
    assert.equal(formatSushiSendGuidanceMessage({ kind: 'countdown', seconds: 18 }, zh), '18 秒后自动送厨 · 同桌还能加');
    assert.equal(formatSushiSendGuidanceMessage({ kind: 'failed' }, zh), zh.guidanceFailed);
    assert.equal(formatSushiSendGuidanceMessage({ kind: 'sent', seconds: 90 }, zh), '已送厨 · 90 秒后可点下一轮');
  });
});

describe('resolveSushiCartSubmitLabel', () => {
  const roundT = SUSHI_ROUND_MESSAGES.zh;
  const placeOrder = MENU_PAGE_MESSAGES.zh.placeOrder;

  it('names what the cart submit actually does', () => {
    assert.equal(resolveSushiCartSubmitLabel({ hasFree: true, hasPaid: false, roundT, placeOrder }), '加入本轮');
    assert.equal(resolveSushiCartSubmitLabel({ hasFree: false, hasPaid: true, roundT, placeOrder }), placeOrder);
    assert.equal(resolveSushiCartSubmitLabel({ hasFree: true, hasPaid: true, roundT, placeOrder }), '下单并加入本轮');
    assert.equal(resolveSushiCartSubmitLabel({ hasFree: false, hasPaid: false, roundT, placeOrder }), placeOrder);
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

  it('maps guest_client_limit to ask-staff copy, never the generic retry toast', () => {
    for (const lang of Object.keys(SUSHI_ROUND_MESSAGES) as Array<keyof typeof SUSHI_ROUND_MESSAGES>) {
      const t = SUSHI_ROUND_MESSAGES[lang];
      const msg = messageForSushiRoundError('guest_client_limit', t);
      assert.equal(msg, t.guestClientLimit);
      assert.notEqual(msg, t.submitFailed);
    }
    assert.equal(
      messageForSushiRoundError('guest_client_limit', SUSHI_ROUND_MESSAGES.pt),
      'Esta mesa atingiu o limite de telemóveis — peça ao staff para fazer o pedido',
    );
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
