import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWaiterBoardCardViewModel,
  formatWaiterBoardCardAmount,
  formatWaiterBoardTitleBadge,
} from '@/lib/waiter-board-card-display';
import { WAITER_BOARD_CARD_MAX_AMOUNT_LABEL } from '@/lib/waiter-board-card-layout';
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';
import { applyBoardSessionRelations } from '@/lib/waiter-board-session-relation';

const LABELS = {
  seatCapacity: '{min}–{max} 座',
  cardIdleReadyHint: '干净整洁 · 可开台',
  cardDiningDuration: '{duration}',
  cardActionOpenTable: '开台',
  cardActionViewOrder: '详情',
  cardActionCheckout: '结账',
  checkoutPendingSubtitle: '待收银收款',
  cardMergedBadge: '拼桌',
  cardTransferredBadge: '转桌',
} as const;

const STATUS = { checkout: '待结账', dining: '用餐中', idle: '空闲' } as const;

function summary(overrides: Partial<WaiterBoardTableSummary> = {}): WaiterBoardTableSummary {
  return {
    tableId: 't1',
    displayName: '002',
    buffetHeadcount: null,
    sessionTotal: 0,
    hasBuffet: false,
    occupied: false,
    seatMin: 2,
    seatMax: 4,
    updatedAt: '',
    ...overrides,
  };
}

function chipText(view: ReturnType<typeof buildWaiterBoardCardViewModel>, kind: string) {
  return view.metaChips.find((chip) => chip.kind === kind)?.text ?? null;
}

describe('buildWaiterBoardCardViewModel', () => {
  const nowMs = Date.parse('2026-07-05T20:00:00.000Z');

  it('idle card: seats + note chips, no amount or title badge', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary(),
      boardState: 'idle',
      action: { kind: 'open_table_sheet' },
      session: undefined,
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.statusLabel, '空闲');
    assert.equal(view.tableTitle, '002');
    assert.equal(view.titleBadge, null);
    assert.deepEqual(
      view.metaChips.map((c) => c.kind),
      ['seats', 'note'],
    );
    assert.equal(chipText(view, 'seats'), '2–4 座');
    assert.equal(chipText(view, 'note'), '干净整洁 · 可开台');
    assert.equal(view.amountText, '');
    assert.equal(view.ctaLabel, '开台');
    assert.equal(view.ctaDisabled, false);
  });

  it('dining card: seats/staff/time chips, headcount as title badge only', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 3, children: 0 }, sessionTotal: 89.9 }),
      boardState: 'dining',
      action: { kind: 'navigate', href: '/waiter/t1' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'open',
        openedByName: '张三',
      },
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.statusLabel, '用餐中');
    assert.equal(view.titleBadge, 'A3');
    assert.equal(chipText(view, 'seats'), '2–4 座');
    assert.equal(chipText(view, 'staff'), '张三');
    assert.equal(chipText(view, 'time'), '2时00分');
    assert.equal(view.amountText, '€89.90');
    assert.equal(view.ctaLabel, '详情');
    assert.equal(view.metaChips.some((c) => c.text.includes('A3')), false);
  });

  it('dining card title badge is A3-C2 when both counts set', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 3, children: 2 }, sessionTotal: 58.4 }),
      boardState: 'dining',
      action: { kind: 'navigate', href: '/waiter/t1' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'open',
      },
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.titleBadge, 'A3-C2');
  });

  it('title badge prefixes 拼桌 / 转桌; merge wins over transfer', () => {
    assert.equal(
      formatWaiterBoardTitleBadge({
        boardState: 'dining',
        headcount: { adults: 2, children: 3 },
        boardRelation: 'merged',
        labels: LABELS,
      }),
      '拼桌 A2-C3',
    );
    assert.equal(
      formatWaiterBoardTitleBadge({
        boardState: 'dining',
        headcount: { adults: 1, children: 0 },
        boardRelation: 'transferred',
        labels: LABELS,
      }),
      '转桌 A1',
    );
    const merged = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 2, children: 0 }, sessionTotal: 10 }),
      boardState: 'dining',
      action: { kind: 'navigate', href: '/waiter/t1' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'open',
        boardRelation: 'merged',
      },
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(merged.titleBadge, '拼桌 A2');
  });

  it('formats six-digit amounts incl. decimals for board cards', () => {
    assert.equal(formatWaiterBoardCardAmount(9999.99), WAITER_BOARD_CARD_MAX_AMOUNT_LABEL);
  });

  it('checkout card on waiter board is display-only with awaiting-payment CTA', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 2, children: 0 }, sessionTotal: 40 }),
      boardState: 'checkout',
      action: { kind: 'disabled', reason: 'waiter_checkout' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'billing',
      },
      checkoutRequestedAt: '2026-07-05T19:00:00.000Z',
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.statusLabel, '待结账');
    assert.equal(view.titleBadge, 'A2');
    assert.equal(chipText(view, 'time'), '1时00分');
    assert.equal(view.amountText, '€40.00');
    assert.equal(view.ctaLabel, '待收银收款');
    assert.equal(view.ctaDisabled, true);
  });

  it('idle card hides amount even when summary has session total', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ sessionTotal: 37 }),
      boardState: 'idle',
      action: { kind: 'open_table_sheet' },
      session: undefined,
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.amountText, '');
  });

  it('checkout on dashboard uses go-to-checkout CTA', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 2, children: 0 }, sessionTotal: 40 }),
      boardState: 'checkout',
      action: { kind: 'open_checkout_sheet' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'billing',
      },
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.ctaLabel, '结账');
  });

  it('board card duration supports single-digit hour ceiling (9时59分)', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 2, children: 0 }, sessionTotal: 9999.99 }),
      boardState: 'dining',
      action: { kind: 'navigate', href: '/waiter/t1' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T10:01:00.000Z',
        status: 'open',
      },
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs: Date.parse('2026-07-05T20:00:00.000Z'),
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(chipText(view, 'time'), '9时59分');
    assert.equal(view.amountText, '€9999.99');
  });

  it('idle card hides opener even when session meta carries openedByName', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary(),
      boardState: 'idle',
      action: { kind: 'open_table_sheet' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'open',
        openedByName: '张三',
      },
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(chipText(view, 'staff'), null);
  });

  it('dining card omits staff chip when openedByName is missing', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 2, children: 0 }, sessionTotal: 10 }),
      boardState: 'dining',
      action: { kind: 'navigate', href: '/waiter/t1' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'open',
      },
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(chipText(view, 'staff'), null);
  });

  it('checkout card shows opener as staff chip only', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 2, children: 0 }, sessionTotal: 40 }),
      boardState: 'checkout',
      action: { kind: 'disabled', reason: 'waiter_checkout' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'billing',
        openedByName: '李四',
      },
      checkoutRequestedAt: '2026-07-05T19:00:00.000Z',
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(chipText(view, 'staff'), '李四');
    assert.equal(chipText(view, 'seats'), '2–4 座');
    assert.equal(view.statusLabel, '待结账');
    assert.match(view.ariaLabel, /李四/);
  });
});

describe('applyBoardSessionRelations', () => {
  it('stamps merged / transferred onto session meta (merge preferred upstream)', () => {
    const next = applyBoardSessionRelations(
      {
        t1: { sessionId: 's1', openedAt: 'x', status: 'open' },
        t2: { sessionId: 's2', openedAt: 'x', status: 'open' },
      },
      new Map([
        ['s1', 'merged'],
        ['s2', 'transferred'],
      ]),
    );
    assert.equal(next.t1.boardRelation, 'merged');
    assert.equal(next.t2.boardRelation, 'transferred');
  });
});
