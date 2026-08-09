'use client';

import Link from 'next/link';
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';
import {
  buildWaiterBoardCardViewModel,
  type WaiterBoardCardMetaChipKind,
} from '@/lib/waiter-board-card-display';
import {
  isWaiterBoardCardInteractive,
  type WaiterBoardCardAction,
} from '@/lib/waiter-board-card-action';
import {
  WAITER_BOARD_CARD_THEME,
  waiterBoardCardShellClass,
  waiterBoardType,
} from '@/lib/waiter-board-card-theme';
import type { WaiterTableBoardState } from '@/lib/waiter-board-session';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import {
  WaiterClockIcon,
  WaiterSeatCapacityIcon,
} from '@/components/waiter/waiter-table-detail-icons';
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

/** Layout only — shell `mesa-scroll-frame` + status comes solely from `waiterBoardCardShellClass`. */
const CARD_BASE_CLASS = 'flex w-full text-left';
const CARD_INNER_CLASS =
  'mesa-scroll-frame__inner flex min-h-[9.25rem] w-full gap-2 p-3';
const CARD_INTERACTIVE_CLASS =
  'group transition-shadow duration-150 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg';

const CHIP_ICON = 'h-3 w-3 shrink-0 text-brand-text';

function MetaChipIcon({ kind }: { kind: WaiterBoardCardMetaChipKind }) {
  if (kind === 'seats') return <WaiterSeatCapacityIcon className={CHIP_ICON} />;
  if (kind === 'time') return <WaiterClockIcon className={CHIP_ICON} />;
  return null;
}

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
      cardMergedBadge: t.cardMergedBadge,
      cardTransferredBadge: t.cardTransferredBadge,
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
    <div className={CARD_INNER_CLASS}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-[1.25rem] items-center justify-between gap-1.5">
          <p className={`${waiterBoardType.cardTitle} ${theme.title}`}>{view.tableTitle}</p>
          {view.titleBadge ? (
            <span className={waiterBoardType.cardBadge}>
              {view.titleBadge.relation ? <span>{view.titleBadge.relation}</span> : null}
              {view.titleBadge.tokens.map((token) => (
                <span key={token}>{token}</span>
              ))}
            </span>
          ) : null}
        </div>

        <div className={waiterBoardType.cardMeta}>
          {view.metaChips.map((chip) => (
            <span key={`${chip.kind}-${chip.text}`} className="inline-flex min-w-0 items-center gap-1">
              <MetaChipIcon kind={chip.kind} />
              <span className="truncate">{chip.text}</span>
            </span>
          ))}
        </div>

        <div className="mesa-card-rule mb-auto" />

        {view.openerName ? (
          <p className={waiterBoardType.cardOpener} title={view.openerName}>
            {view.openerName}
          </p>
        ) : null}

        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className={waiterBoardType.cardAmountSlot}>
            {view.amountText ? (
              <span className={waiterBoardType.cardAmount}>{view.amountText}</span>
            ) : view.idleHint ? (
              <span className={waiterBoardType.cardIdleHint}>{view.idleHint}</span>
            ) : null}
          </span>
          <span
            aria-hidden
            className={`${waiterBoardType.cardCta} ${theme.cta} ${
              view.ctaDisabled ? 'opacity-55' : ''
            }`}
          >
            {view.ctaLabel} →
          </span>
        </div>
      </div>

      <div className={waiterBoardType.cardStatus} aria-hidden>
        {view.statusLabel}
      </div>
    </div>
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
