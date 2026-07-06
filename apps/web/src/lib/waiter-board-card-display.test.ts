import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWaiterBoardCardViewModel,
  formatWaiterBoardCardAmount,
  formatWaiterBoardCardRow3Meta,
} from '@/lib/waiter-board-card-display';
import { WAITER_BOARD_CARD_MAX_AMOUNT_LABEL } from '@/lib/waiter-board-card-layout';
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';

const LABELS = {
  table: '桌',
  seatCapacity: '{min}–{max} 座',
  cardIdleReadyHint: '干净整洁，可开台',
  cardDiningDuration: '用时 {duration}',
  cardActionOpenTable: '点击开台',
  cardActionViewOrder: '查看订单',
  cardActionViewDetail: '查看详情',
  cardActionCheckout: '去结账',
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

describe('buildWaiterBoardCardViewModel', () => {
  const nowMs = Date.parse('2026-07-05T20:00:00.000Z');

  it('idle card fills fixed slots without guest count or amount', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary(),
      boardState: 'idle',
      action: { kind: 'open_table_sheet' },
      session: undefined,
      checkoutRequestedAt: null,
      embeddedInDashboard: true,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row1.badgeLabel, '空闲');
    assert.equal(view.row2.capacityText, '2–4 座');
    assert.equal(view.row2.guestCountText, '');
    assert.equal(view.row3.metaPrefix, '干净整洁，可开台');
    assert.equal(view.row3.metaHighlight, '');
    assert.equal(view.row3.amountText, '');
    assert.equal(view.row4.footerLabel, '点击开台');
    assert.equal(view.row4.footerIcon, 'open_table');
    assert.equal(view.row4.footerDisabled, false);
  });

  it('dining card uses compact board duration and amount on row3', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 3, children: 0 }, sessionTotal: 89.9 }),
      boardState: 'dining',
      action: { kind: 'navigate', href: '/waiter/t1' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'open',
      },
      checkoutRequestedAt: null,
      embeddedInDashboard: false,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row2.guestCountText, 'A3');
    assert.equal(view.row3.metaPrefix, '用时 ');
    assert.equal(view.row3.metaHighlight, '2时0分');
    assert.equal(formatWaiterBoardCardRow3Meta(view.row3), '用时 2时0分');
    assert.equal(view.row3.amountText, '€89.90');
    assert.equal(view.row4.footerLabel, '查看订单');
    assert.equal(view.row4.footerIcon, 'view_order');
  });

  it('dining card shows A3C2 when both adult and child counts are set', () => {
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
      embeddedInDashboard: false,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row2.guestCountText, 'A3C2');
  });

  it('formats six-digit amounts incl. decimals for board cards', () => {
    assert.equal(formatWaiterBoardCardAmount(9999.99), WAITER_BOARD_CARD_MAX_AMOUNT_LABEL);
  });

  it('checkout card matches dining row3 shape without checkout subtitle', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ buffetHeadcount: { adults: 2, children: 0 }, sessionTotal: 40 }),
      boardState: 'checkout',
      action: { kind: 'navigate', href: '/waiter/t1' },
      session: {
        sessionId: 's1',
        openedAt: '2026-07-05T18:00:00.000Z',
        status: 'billing',
      },
      checkoutRequestedAt: '2026-07-05T19:00:00.000Z',
      embeddedInDashboard: false,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row1.badgeLabel, '待结账');
    assert.equal(view.row2.guestCountText, 'A2');
    assert.match(formatWaiterBoardCardRow3Meta(view.row3), /^用时 /);
    assert.doesNotMatch(formatWaiterBoardCardRow3Meta(view.row3), /待收银/);
    assert.equal(view.row3.amountText, '€40.00');
    assert.equal(view.row4.footerLabel, '查看详情');
    assert.equal(view.row4.footerIcon, 'view_detail');
  });

  it('idle card hides amount even when summary has session total', () => {
    const view = buildWaiterBoardCardViewModel({
      card: summary({ sessionTotal: 37 }),
      boardState: 'idle',
      action: { kind: 'open_table_sheet' },
      session: undefined,
      checkoutRequestedAt: null,
      embeddedInDashboard: true,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row3.amountText, '');
  });

  it('checkout on dashboard uses go-to-checkout footer', () => {
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
      embeddedInDashboard: true,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row4.footerLabel, '去结账');
    assert.equal(view.row4.footerIcon, 'checkout');
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
      embeddedInDashboard: false,
      lang: 'zh',
      nowMs: Date.parse('2026-07-05T20:00:00.000Z'),
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row3.metaHighlight, '9时59分');
    assert.equal(formatWaiterBoardCardRow3Meta(view.row3), '用时 9时59分');
    assert.equal(view.row3.amountText, '€9999.99');
  });
});
