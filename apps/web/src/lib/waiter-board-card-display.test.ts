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
  seatCapacity: '{min}–{max} 座',
  cardIdleReadyHint: '干净整洁，可开台',
  cardDiningDuration: '用时 {duration}',
  cardActionOpenTable: '开台',
  cardActionViewOrder: '详情',
  cardActionCheckout: '结账',
  checkoutPendingSubtitle: '待收银收款',
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
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row1.badgeLabel, '空闲');
    assert.equal(view.row1.tableTitle, '002');
    assert.equal(view.openerRow.label, null);
    assert.equal(view.row2.capacityText, '2–4 座');
    assert.equal(view.row2.guestCountText, '');
    assert.equal(view.row3.metaPrefix, '干净整洁，可开台');
    assert.equal(view.row3.metaHighlight, '');
    assert.equal(view.row3.amountText, '');
    assert.equal(view.row4.footerLabel, '开台');
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
        openedByName: '张三',
      },
      checkoutRequestedAt: null,
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row1.badgeLabel, '用餐中');
    assert.equal(view.row1.tableTitle, '002');
    assert.equal(view.openerRow.label, '张三');
    assert.equal(view.row2.guestCountText, 'A3');
    assert.equal(view.row3.metaPrefix, '用时 ');
    assert.equal(view.row3.metaHighlight, '2时0分');
    assert.equal(formatWaiterBoardCardRow3Meta(view.row3), '用时 2时0分');
    assert.equal(view.row3.amountText, '€89.90');
    assert.equal(view.row4.footerLabel, '详情');
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

  it('checkout card on waiter board is display-only with awaiting-payment footer', () => {
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
    assert.equal(view.row1.badgeLabel, '待结账');
    assert.equal(view.row2.guestCountText, 'A2');
    assert.match(formatWaiterBoardCardRow3Meta(view.row3), /^用时 /);
    assert.equal(view.row3.amountText, '€40.00');
    assert.equal(view.row4.footerLabel, '待收银收款');
    assert.equal(view.row4.footerIcon, 'checkout');
    assert.equal(view.row4.footerDisabled, true);
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
      lang: 'zh',
      nowMs,
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row4.footerLabel, '结账');
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
      lang: 'zh',
      nowMs: Date.parse('2026-07-05T20:00:00.000Z'),
      labels: LABELS,
      statusLabels: STATUS,
    });
    assert.equal(view.row3.metaHighlight, '9时59分');
    assert.equal(formatWaiterBoardCardRow3Meta(view.row3), '用时 9时59分');
    assert.equal(view.row3.amountText, '€9999.99');
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
    assert.equal(view.openerRow.label, null);
  });

  it('dining card hides opener when openedByName is missing', () => {
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
    assert.equal(view.openerRow.label, null);
  });

  it('checkout card shows opener on dedicated row', () => {
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
    assert.equal(view.openerRow.label, '李四');
    assert.equal(view.row1.badgeLabel, '待结账');
    assert.match(view.ariaLabel, /李四/);
  });
});
