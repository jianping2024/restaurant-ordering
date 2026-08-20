import type { UILanguage } from '@/lib/i18n';
import { buffetHeadcountTokenParts } from '@/lib/buffet-order';
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

/** Meta row only — seats and dining duration (opener / idle hint are not chips). */
export type WaiterBoardCardMetaChipKind = 'seats' | 'time';

export type WaiterBoardCardMetaChip = {
  kind: WaiterBoardCardMetaChipKind;
  text: string;
};

/**
 * Sole floor-card headcount / relation badge — rendered on the status rail.
 * `tokens` = adult-first A/C lines as separate soft tags; `relation` optional above.
 */
export type WaiterBoardStatusBadge = {
  relation: string | null;
  tokens: string[];
};

/**
 * Sole floor-card display shape (6-col dense).
 * Title = tableTitle only; meta = seats/time;
 * status rail = statusLabel + statusBadge (headcount, not seat capacity);
 * below rule = opener slot (name or empty) then amountText XOR idleHint.
 */
export type WaiterBoardCardViewModel = {
  boardState: WaiterTableBoardState;
  tableTitle: string;
  /** Vertical status glyph on the status rail. */
  statusLabel: string;
  /**
   * Sole headcount/relation badge on the status rail, or null.
   * Not a hyphenated string and not a second badge slot.
   */
  statusBadge: WaiterBoardStatusBadge | null;
  /** Opener below card rule (dining/checkout only). */
  openerName: string | null;
  metaChips: WaiterBoardCardMetaChip[];
  /**
   * Idle-only hint below the rule (amount slot). Mutually exclusive with amountText.
   */
  idleHint: string | null;
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

/** Aria / speech join for the sole status-rail badge — not a second display shape. */
export function waiterBoardStatusBadgeAriaText(badge: WaiterBoardStatusBadge): string {
  return [badge.relation, ...badge.tokens].filter(Boolean).join(' ');
}

function statusLabelForState(
  boardState: WaiterTableBoardState,
  statusLabels: { checkout: string; dining: string; idle: string },
): string {
  if (boardState === 'checkout') return statusLabels.checkout;
  if (boardState === 'dining') return statusLabels.dining;
  return statusLabels.idle;
}

/** Sole status-rail badge composer — relation + adult-first token list. */
export function formatWaiterBoardStatusBadge(input: {
  boardState: WaiterTableBoardState;
  headcount: WaiterBoardTableSummary['buffetHeadcount'];
  boardRelation: WaiterBoardSessionRelation | null | undefined;
  labels: Pick<WaiterBoardCardDisplayLabels, 'cardMergedBadge' | 'cardTransferredBadge'>;
}): WaiterBoardStatusBadge | null {
  const tokens =
    input.boardState === 'idle' || !input.headcount
      ? []
      : buffetHeadcountTokenParts(input.headcount.adults, input.headcount.children);

  const relation =
    input.boardRelation === 'merged'
      ? input.labels.cardMergedBadge
      : input.boardRelation === 'transferred'
        ? input.labels.cardTransferredBadge
        : null;

  if (!relation && tokens.length === 0) return null;
  return { relation, tokens };
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
  labels: Pick<WaiterBoardCardDisplayLabels, 'cardDiningDuration'>;
}): WaiterBoardCardMetaChip[] {
  const chips: WaiterBoardCardMetaChip[] = [{ kind: 'seats', text: input.capacityText }];

  if (input.boardState === 'idle') {
    return chips;
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

function openerNameForState(
  boardState: WaiterTableBoardState,
  session: WaiterTableSessionMeta | undefined,
): string | null {
  if (boardState === 'idle') return null;
  const opener = session?.openedByName?.trim();
  return opener || null;
}

function buildAriaLabel(view: Omit<WaiterBoardCardViewModel, 'ariaLabel'>): string {
  const parts = [
    view.tableTitle,
    view.openerName,
    view.statusLabel,
    view.statusBadge ? waiterBoardStatusBadgeAriaText(view.statusBadge) : null,
    ...view.metaChips.map((chip) => chip.text),
    view.idleHint,
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
  const isIdle = input.boardState === 'idle';

  const draft: Omit<WaiterBoardCardViewModel, 'ariaLabel'> = {
    boardState: input.boardState,
    tableTitle: input.card.displayName,
    statusLabel: statusLabelForState(input.boardState, input.statusLabels),
    statusBadge: formatWaiterBoardStatusBadge({
      boardState: input.boardState,
      headcount: input.card.buffetHeadcount,
      boardRelation: input.session?.boardRelation,
      labels: input.labels,
    }),
    openerName: openerNameForState(input.boardState, input.session),
    metaChips: buildMetaChips({
      boardState: input.boardState,
      capacityText,
      session: input.session,
      checkoutRequestedAt: input.checkoutRequestedAt,
      lang: input.lang,
      nowMs: input.nowMs,
      labels: input.labels,
    }),
    idleHint: isIdle ? input.labels.cardIdleReadyHint : null,
    amountText: isIdle ? '' : formatWaiterBoardCardAmount(input.card.sessionTotal),
    ctaLabel: input.labels[actionLabelKey],
    ctaDisabled: input.action.kind === 'disabled',
  };

  return {
    ...draft,
    ariaLabel: buildAriaLabel(draft),
  };
}
