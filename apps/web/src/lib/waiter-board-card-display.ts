import type { UILanguage } from '@/lib/i18n';
import { formatBuffetReceiptQtyLabel } from '@/lib/buffet-order';
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';
import type { WaiterTableBoardState } from '@/lib/waiter-board-session';
import { formatSessionDurationForBoardCard, type WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import {
  waiterBoardCardActionLabelKey,
  type WaiterBoardCardAction,
} from '@/lib/waiter-board-card-action';

export type WaiterBoardCardDisplayLabels = {
  seatCapacity: string;
  cardIdleReadyHint: string;
  cardDiningDuration: string;
  cardActionOpenTable: string;
  cardActionViewOrder: string;
  cardActionCheckout: string;
  checkoutPendingSubtitle: string;
};

export type WaiterBoardCardFooterIcon = 'open_table' | 'view_order' | 'checkout';

export type WaiterBoardCardRowSlots = {
  row1: { tableTitle: string; badgeLabel: string };
  row2: { capacityText: string; openerLabel: string | null; guestCountText: string };
  row3: { metaPrefix: string; metaHighlight: string; amountText: string };
  row4: { footerLabel: string; footerIcon: WaiterBoardCardFooterIcon; footerDisabled: boolean };
};

export type WaiterBoardCardViewModel = WaiterBoardCardRowSlots & {
  boardState: WaiterTableBoardState;
  ariaLabel: string;
};

export function formatTableSeatCapacity(
  seatMin: number,
  seatMax: number,
  template: string,
): string {
  return template.replace('{min}', String(seatMin)).replace('{max}', String(seatMax));
}

export function formatWaiterBoardCardAmount(sessionTotal: number): string {
  if (sessionTotal <= 0) return '';
  return `€${sessionTotal.toFixed(2)}`;
}

export function formatWaiterBoardCardCapacityLine(
  capacityText: string,
  openerLabel: string | null,
): string {
  if (!openerLabel) return capacityText;
  return `${capacityText} ${openerLabel}`;
}

export function formatWaiterBoardCardRow3Meta(row3: WaiterBoardCardRowSlots['row3']): string {
  if (!row3.metaHighlight) return row3.metaPrefix;
  return `${row3.metaPrefix}${row3.metaHighlight}`;
}

function badgeLabelForState(
  boardState: WaiterTableBoardState,
  statusLabels: { checkout: string; dining: string; idle: string },
): string {
  if (boardState === 'checkout') return statusLabels.checkout;
  if (boardState === 'dining') return statusLabels.dining;
  return statusLabels.idle;
}

function openerLabelForCard(
  boardState: WaiterTableBoardState,
  session: WaiterTableSessionMeta | undefined,
): string | null {
  if (boardState === 'idle') return null;
  const name = session?.openedByName?.trim();
  return name || null;
}

function boardHeadcountText(
  boardState: WaiterTableBoardState,
  headcount: WaiterBoardTableSummary['buffetHeadcount'],
): string {
  if (boardState === 'idle' || !headcount) return '';
  return formatBuffetReceiptQtyLabel(headcount.adults, headcount.children);
}

function diningDurationSlots(
  session: WaiterTableSessionMeta | undefined,
  checkoutRequestedAt: string | null,
  lang: UILanguage,
  nowMs: number,
  template: string,
): { metaPrefix: string; metaHighlight: string } {
  const withoutDuration = template.replace(/\s*\{duration\}\s*/g, '').trim();
  if (!session) {
    return { metaPrefix: withoutDuration, metaHighlight: '' };
  }
  const duration = formatSessionDurationForBoardCard(
    session.openedAt,
    checkoutRequestedAt,
    lang,
    nowMs,
  );
  if (!duration) {
    return { metaPrefix: withoutDuration, metaHighlight: '' };
  }
  const placeholder = '{duration}';
  const index = template.indexOf(placeholder);
  if (index === -1) {
    return { metaPrefix: template, metaHighlight: duration };
  }
  return {
    metaPrefix: template.slice(0, index),
    metaHighlight: duration,
  };
}

function row3Slots(input: {
  boardState: WaiterTableBoardState;
  sessionTotal: number;
  session: WaiterTableSessionMeta | undefined;
  checkoutRequestedAt: string | null;
  lang: UILanguage;
  nowMs: number;
  labels: Pick<WaiterBoardCardDisplayLabels, 'cardIdleReadyHint' | 'cardDiningDuration'>;
}): WaiterBoardCardRowSlots['row3'] {
  if (input.boardState === 'idle') {
    return {
      metaPrefix: input.labels.cardIdleReadyHint,
      metaHighlight: '',
      amountText: '',
    };
  }
  const duration = diningDurationSlots(
    input.session,
    input.checkoutRequestedAt,
    input.lang,
    input.nowMs,
    input.labels.cardDiningDuration,
  );
  return {
    ...duration,
    amountText: formatWaiterBoardCardAmount(input.sessionTotal),
  };
}

function footerIconForLabelKey(
  labelKey: ReturnType<typeof waiterBoardCardActionLabelKey>,
): WaiterBoardCardFooterIcon {
  if (labelKey === 'cardActionOpenTable') return 'open_table';
  if (labelKey === 'cardActionCheckout' || labelKey === 'checkoutPendingSubtitle') return 'checkout';
  return 'view_order';
}

function buildAriaLabel(slots: WaiterBoardCardRowSlots): string {
  const parts = [
    slots.row1.tableTitle,
    slots.row1.badgeLabel,
    formatWaiterBoardCardCapacityLine(slots.row2.capacityText, slots.row2.openerLabel),
    slots.row2.guestCountText,
    formatWaiterBoardCardRow3Meta(slots.row3),
    slots.row3.amountText,
    slots.row4.footerLabel,
  ].filter((part): part is string => Boolean(part && part.length > 0));
  return parts.join('，');
}

export function buildWaiterBoardCardViewModel(input: {
  card: WaiterBoardTableSummary;
  boardState: WaiterTableBoardState;
  action: WaiterBoardCardAction;
  session: WaiterTableSessionMeta | undefined;
  checkoutRequestedAt: string | null;
  lang: UILanguage;
  nowMs: number;
  labels: WaiterBoardCardDisplayLabels;
  statusLabels: {
    checkout: string;
    dining: string;
    idle: string;
  };
}): WaiterBoardCardViewModel {
  const actionLabelKey = waiterBoardCardActionLabelKey(
    input.action,
    input.boardState,
  );

  const slots: WaiterBoardCardRowSlots = {
    row1: {
      tableTitle: input.card.displayName,
      badgeLabel: badgeLabelForState(input.boardState, input.statusLabels),
    },
    row2: {
      capacityText: formatTableSeatCapacity(
        input.card.seatMin,
        input.card.seatMax,
        input.labels.seatCapacity,
      ),
      openerLabel: openerLabelForCard(input.boardState, input.session),
      guestCountText: boardHeadcountText(input.boardState, input.card.buffetHeadcount),
    },
    row3: row3Slots({
      boardState: input.boardState,
      sessionTotal: input.card.sessionTotal,
      session: input.session,
      checkoutRequestedAt: input.checkoutRequestedAt,
      lang: input.lang,
      nowMs: input.nowMs,
      labels: input.labels,
    }),
    row4: {
      footerLabel: input.labels[actionLabelKey],
      footerIcon: footerIconForLabelKey(actionLabelKey),
      footerDisabled: input.action.kind === 'disabled',
    },
  };

  return {
    ...slots,
    boardState: input.boardState,
    ariaLabel: buildAriaLabel(slots),
  };
}
