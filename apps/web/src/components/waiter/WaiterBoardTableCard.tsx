'use client';

import Link from 'next/link';
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';
import {
  buildWaiterBoardCardViewModel,
  formatWaiterBoardCardCapacityLine,
} from '@/lib/waiter-board-card-display';
import {
  isWaiterBoardCardInteractive,
  type WaiterBoardCardAction,
} from '@/lib/waiter-board-card-action';
import {
  WAITER_BOARD_CARD_ROW1_LAYOUT,
  WAITER_BOARD_CARD_ROW2_LAYOUT,
  WAITER_BOARD_CARD_ROW3_LAYOUT,
} from '@/lib/waiter-board-card-layout';
import {
  WAITER_BOARD_CARD_THEME,
  waiterBoardCardShellClass,
  waiterBoardType,
} from '@/lib/waiter-board-card-theme';
import type { WaiterTableBoardState } from '@/lib/waiter-board-session';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import { WaiterBoardCardFooter } from '@/components/waiter/WaiterBoardCardFooter';
import { WaiterSeatCapacityIcon } from '@/components/waiter/waiter-table-detail-icons';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import type { UILanguage } from '@/lib/i18n';

type Props = {
  card: WaiterBoardTableSummary;
  boardState: WaiterTableBoardState;
  action: WaiterBoardCardAction;
  session: WaiterTableSessionMeta | undefined;
  checkoutRequestedAt: string | null;
  nowMs: number;
  lang: UILanguage;
  pinned?: boolean;
  onOpenTable: () => void;
  onOpenCheckout: () => void;
  onDisabledClick: () => void;
};

const CARD_BASE_CLASS =
  'flex min-h-[8.25rem] flex-col rounded-xl border text-left w-full p-4';
const CARD_INTERACTIVE_CLASS =
  'group transition-all duration-150 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg';

export function WaiterBoardTableCard({
  card,
  boardState,
  action,
  session,
  checkoutRequestedAt,
  nowMs,
  lang,
  pinned = false,
  onOpenTable,
  onOpenCheckout,
  onDisabledClick,
}: Props) {
  const t = WAITER_TEXT[lang];
  const view = buildWaiterBoardCardViewModel({
    card,
    boardState,
    action,
    session,
    checkoutRequestedAt,
    lang,
    nowMs,
    labels: {
      seatCapacity: t.seatCapacity,
      cardIdleReadyHint: t.cardIdleReadyHint,
      cardDiningDuration: t.cardDiningDuration,
      cardActionOpenTable: t.cardActionOpenTable,
      cardActionViewOrder: t.cardActionViewOrder,
      cardActionCheckout: t.cardActionCheckout,
      checkoutPendingSubtitle: t.checkoutPendingSubtitle,
    },
    statusLabels: {
      checkout: t.checkoutPendingShort,
      dining: t.statusDining,
      idle: t.inactive,
    },
  });

  const interactive = isWaiterBoardCardInteractive(action);
  const theme = WAITER_BOARD_CARD_THEME[boardState];
  const cardClassName = [
    CARD_BASE_CLASS,
    interactive ? CARD_INTERACTIVE_CLASS : 'cursor-default',
    waiterBoardCardShellClass(boardState, interactive),
    pinned ? 'ring-2 ring-amber-500/35' : '',
    action.kind === 'disabled' && action.reason === 'no_buffet_config' ? 'opacity-85' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <div className="flex items-start justify-between gap-2 min-h-[1.25rem]">
        <p className={`${waiterBoardType.cardTitle} ${theme.title}`}>
          {view.row1.tableTitle}
        </p>
        <span className={`${WAITER_BOARD_CARD_ROW1_LAYOUT.badge} ${theme.badge}`}>
          {view.row1.badgeLabel}
        </span>
      </div>

      <div className={WAITER_BOARD_CARD_ROW2_LAYOUT.row}>
        <p className={WAITER_BOARD_CARD_ROW2_LAYOUT.capacity}>
          <WaiterSeatCapacityIcon className={WAITER_BOARD_CARD_ROW2_LAYOUT.capacityIcon} />
          <span
            className="truncate"
            title={
              view.row2.openerLabel
                ? formatWaiterBoardCardCapacityLine(
                    view.row2.capacityText,
                    view.row2.openerLabel,
                  )
                : undefined
            }
          >
            {formatWaiterBoardCardCapacityLine(view.row2.capacityText, view.row2.openerLabel)}
          </span>
        </p>
        <p className={WAITER_BOARD_CARD_ROW2_LAYOUT.guestCount}>{view.row2.guestCountText}</p>
      </div>

      <div className={WAITER_BOARD_CARD_ROW3_LAYOUT.row}>
        <p className={`${WAITER_BOARD_CARD_ROW3_LAYOUT.meta} ${theme.row3}`}>
          <span className={theme.meta}>{view.row3.metaPrefix}</span>
          {view.row3.metaHighlight ? (
            <span className={theme.durationAccent}>{view.row3.metaHighlight}</span>
          ) : null}
        </p>
        {view.row3.amountText ? (
          <span className={`${WAITER_BOARD_CARD_ROW3_LAYOUT.amount} ${theme.row3} ${theme.amount}`}>
            {view.row3.amountText}
          </span>
        ) : null}
      </div>

      <div className="mt-auto">
        <WaiterBoardCardFooter
          label={view.row4.footerLabel}
          icon={view.row4.footerIcon}
          footerClassName={theme.footer}
          disabled={view.row4.footerDisabled}
        />
      </div>
    </>
  );

  if (action.kind === 'disabled' && action.reason === 'waiter_checkout') {
    return (
      <article className={cardClassName} aria-label={view.ariaLabel}>
        {body}
      </article>
    );
  }

  if (action.kind === 'open_table_sheet') {
    return (
      <button type="button" className={cardClassName} aria-label={view.ariaLabel} onClick={onOpenTable}>
        {body}
      </button>
    );
  }

  if (action.kind === 'open_checkout_sheet') {
    return (
      <button
        type="button"
        className={cardClassName}
        aria-label={view.ariaLabel}
        onClick={onOpenCheckout}
      >
        {body}
      </button>
    );
  }

  if (action.kind === 'disabled') {
    return (
      <button
        type="button"
        className={cardClassName}
        aria-label={view.ariaLabel}
        onClick={onDisabledClick}
      >
        {body}
      </button>
    );
  }

  return (
    <Link href={action.href} className={cardClassName} aria-label={view.ariaLabel}>
      {body}
    </Link>
  );
}
