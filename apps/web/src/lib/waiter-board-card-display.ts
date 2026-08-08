import type { UILanguage } from '@/lib/i18n';
import { formatBuffetReceiptQtyLabel } from '@/lib/buffet-order';
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';
import type {
  WaiterBoardSessionRelation,
  WaiterTableBoardState,
} from '@/lib/waiter-board-session';
import { formatSessionDurationForBoardCard, type WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import {
  waiterBoardCardActionLabelKey,
  type WaiterBoardCardAction,
} from '@/lib/waiter-board-card-action';

export type WaiterBoardCardDisplayLabels = {
  seatCapacity: string;
  cardIdleReadyHint: string;
  /** Board duration chip — mockup is bare `{duration}` (no 「用时」prefix). */
  cardDiningDuration: string;
  cardActionOpenTable: string;
  cardActionViewOrder: string;
  cardActionCheckout: string;
  checkoutPendingSubtitle: string;
  /** Title-badge relation prefixes (mockup 拼桌 / 转桌). */
  cardMergedBadge: string;
  cardTransferredBadge: string;
};

/** One meta chip on the mockup card — seats / staff / time / idle note. */
export type WaiterBoardCardMetaChipKind = 'seats' | 'staff' | 'time' | 'note';

export type WaiterBoardCardMetaChip = {
  kind: WaiterBoardCardMetaChipKind;
  text: string;
};

/**
 * Sole floor-card display shape (mockup template).
 * Title-row gold pill = `titleBadge` only (relation prefix + headcount).
 */
export type WaiterBoardCardViewModel = {
  boardState: WaiterTableBoardState;
  tableTitle: string;
  /** Vertical colophon status. */
  statusLabel: string;
  /**
   * Sole title-row gold pill: `拼桌 A3-C2` / `转桌 A3` / `A3-C2` / null.
   * Relation prefix + buffet headcount — not a second badge slot.
   */
  titleBadge: string | null;
  metaChips: WaiterBoardCardMetaChip[];
  amountText: string;
  ctaLabel: string;
  ctaDisabled: boolean;
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

function statusLabelForState(
  boardState: WaiterTableBoardState,
  statusLabels: { checkout: string; dining: string; idle: string },
): string {
  if (boardState === 'checkout') return statusLabels.checkout;
  if (boardState === 'dining') return statusLabels.dining;
  return statusLabels.idle;
}

/** Sole title-badge composer — relation prefix then headcount. */
export function formatWaiterBoardTitleBadge(input: {
  boardState: WaiterTableBoardState;
  headcount: WaiterBoardTableSummary['buffetHeadcount'];
  boardRelation: WaiterBoardSessionRelation | null | undefined;
  labels: Pick<WaiterBoardCardDisplayLabels, 'cardMergedBadge' | 'cardTransferredBadge'>;
}): string | null {
  const headcountLabel =
    input.boardState === 'idle' || !input.headcount
      ? null
      : formatBuffetReceiptQtyLabel(input.headcount.adults, input.headcount.children) || null;

  const prefix =
    input.boardRelation === 'merged'
      ? input.labels.cardMergedBadge
      : input.boardRelation === 'transferred'
        ? input.labels.cardTransferredBadge
        : null;

  if (prefix && headcountLabel) return `${prefix} ${headcountLabel}`;
  if (prefix) return prefix;
  return headcountLabel;
}

function diningDurationText(
  session: WaiterTableSessionMeta | undefined,
  checkoutRequestedAt: string | null,
  lang: UILanguage,
  nowMs: number,
  template: string,
): string {
  if (!session) {
    return template.replace(/\s*\{duration\}\s*/g, '').trim();
  }
  const duration = formatSessionDurationForBoardCard(
    session.openedAt,
    checkoutRequestedAt,
    lang,
    nowMs,
  );
  if (!duration) {
    return template.replace(/\s*\{duration\}\s*/g, '').trim();
  }
  return template.replace('{duration}', duration);
}

function buildMetaChips(input: {
  boardState: WaiterTableBoardState;
  capacityText: string;
  session: WaiterTableSessionMeta | undefined;
  checkoutRequestedAt: string | null;
  lang: UILanguage;
  nowMs: number;
  labels: Pick<WaiterBoardCardDisplayLabels, 'cardIdleReadyHint' | 'cardDiningDuration'>;
}): WaiterBoardCardMetaChip[] {
  const chips: WaiterBoardCardMetaChip[] = [{ kind: 'seats', text: input.capacityText }];

  if (input.boardState === 'idle') {
    chips.push({ kind: 'note', text: input.labels.cardIdleReadyHint });
    return chips;
  }

  const opener = input.session?.openedByName?.trim();
  if (opener) {
    chips.push({ kind: 'staff', text: opener });
  }

  const timeText = diningDurationText(
    input.session,
    input.checkoutRequestedAt,
    input.lang,
    input.nowMs,
    input.labels.cardDiningDuration,
  );
  if (timeText) {
    chips.push({ kind: 'time', text: timeText });
  }

  return chips;
}

function buildAriaLabel(view: Omit<WaiterBoardCardViewModel, 'ariaLabel'>): string {
  const parts = [
    view.tableTitle,
    view.statusLabel,
    view.titleBadge,
    ...view.metaChips.map((chip) => chip.text),
    view.amountText,
    view.ctaLabel,
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
  const actionLabelKey = waiterBoardCardActionLabelKey(input.action, input.boardState);
  const capacityText = formatTableSeatCapacity(
    input.card.seatMin,
    input.card.seatMax,
    input.labels.seatCapacity,
  );

  const draft: Omit<WaiterBoardCardViewModel, 'ariaLabel'> = {
    boardState: input.boardState,
    tableTitle: input.card.displayName,
    statusLabel: statusLabelForState(input.boardState, input.statusLabels),
    titleBadge: formatWaiterBoardTitleBadge({
      boardState: input.boardState,
      headcount: input.card.buffetHeadcount,
      boardRelation: input.session?.boardRelation,
      labels: input.labels,
    }),
    metaChips: buildMetaChips({
      boardState: input.boardState,
      capacityText,
      session: input.session,
      checkoutRequestedAt: input.checkoutRequestedAt,
      lang: input.lang,
      nowMs: input.nowMs,
      labels: input.labels,
    }),
    amountText:
      input.boardState === 'idle'
        ? ''
        : formatWaiterBoardCardAmount(input.card.sessionTotal),
    ctaLabel: input.labels[actionLabelKey],
    ctaDisabled: input.action.kind === 'disabled',
  };

  return {
    ...draft,
    ariaLabel: buildAriaLabel(draft),
  };
}
