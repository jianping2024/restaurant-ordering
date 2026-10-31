'use client';

import { Button } from '@/components/ui/Button';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { PeerFloatDishThumb } from '@/components/menu/PeerFloatDishThumb';
import { APPEND_CART_QTY_MAX } from '@/types';
import { CustomerMenuBottomSheet } from '@/components/menu/CustomerMenuBottomSheet';
import type {
  RoundReviewGroup,
  RoundReviewPaidSentLine,
} from '@/lib/table-order-round/own-review-lines';
import type { SushiSendGuidance } from '@/lib/table-order-round/send-guidance';
import { SushiSendGuidanceNotice } from '@/components/menu/sushi/SushiSendGuidance';
import type { Language } from '@/types';

type Labels = {
  title: string;
  heroTitle: string;
  heroLead: string;
  empty: string;
  /** Dismiss while sendable (再加点). */
  addMore: string;
  continueOrdering: string;
  sendRound: string;
  sendRoundCount: string;
  paidJustOrdered: string | null;
  paidSentTitle: string;
};

type Props = {
  open: boolean;
  groups: RoundReviewGroup[];
  labels: Labels;
  /** Unsent table qty for hero / send CTA count. */
  tableQty: number;
  /** Read-only paid rows already sent this round (never sent again, not counted). */
  paidSentLines: RoundReviewPaidSentLine[];
  /** Same live guidance as the footer strip (unsent / countdown / failed). */
  guidance: SushiSendGuidance | null;
  /** Geo / send failure shown inside the sheet (keep open). */
  sendError: string | null;
  lang: Language;
  canSend: boolean;
  sendBusy: boolean;
  /** Countdown active — send button disabled. */
  countdownActive: boolean;
  /** lineId currently waiting on upsert/delete. */
  busyLineId: string | null;
  onClose: () => void;
  onSend: () => void;
  onOwnLineQtyChange: (lineId: string, nextQty: number) => void;
};

function BatchTimeDivider({ label }: { label: string }) {
  if (!label) {
    return <div className="mb-2 border-t border-dashed border-brand-border" aria-hidden="true" />;
  }
  return (
    <div className="mb-2 flex items-center gap-3">
      <div className="flex-1 border-t border-dashed border-brand-border" aria-hidden="true" />
      <span className="shrink-0 text-[12px] tabular-nums text-brand-text-muted">{label}</span>
      <div className="flex-1 border-t border-dashed border-brand-border" aria-hidden="true" />
    </div>
  );
}

/** Sole sushi round-review sheet: own lines use CartQtyStepper; peers read-only qty. */
export function SushiRoundReviewDrawer({
  open,
  groups,
  labels,
  tableQty,
  paidSentLines,
  guidance,
  sendError,
  lang,
  canSend,
  sendBusy,
  countdownActive,
  busyLineId,
  onClose,
  onSend,
  onOwnLineQtyChange,
}: Props) {
  const urgent = canSend && tableQty > 0;
  const notice = !urgent && guidance && guidance.kind !== 'sent' ? guidance : null;
  const sendLabel = urgent
    ? labels.sendRoundCount.replace('{count}', String(tableQty))
    : labels.sendRound;

  return (
    <CustomerMenuBottomSheet
      open={open}
      onClose={onClose}
      title={urgent ? labels.heroTitle : labels.title}
      footer={
        urgent ? (
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="gold"
              size="action"
              className="w-full whitespace-normal px-3 py-3.5 text-[15px] leading-snug"
              disabled={!canSend || sendBusy || countdownActive}
              loading={sendBusy}
              onClick={onSend}
            >
              {sendLabel}
            </Button>
            <button
              type="button"
              className="w-full py-2 text-center text-sm text-brand-text-muted"
              onClick={onClose}
            >
              {labels.addMore}
            </button>
          </div>
        ) : (
          <div className="flex items-stretch gap-3">
            <Button
              type="button"
              variant="outline"
              size="action"
              className="min-w-0 flex-1 whitespace-nowrap"
              onClick={onClose}
            >
              {labels.continueOrdering}
            </Button>
            <Button
              type="button"
              variant="gold"
              size="action"
              className="min-w-0 flex-1 whitespace-nowrap"
              disabled={!canSend || sendBusy || countdownActive}
              loading={sendBusy}
              onClick={onSend}
            >
              {sendLabel}
            </Button>
          </div>
        )
      }
    >
      {urgent ? (
        <div className="mb-3 text-center">
          <div
            className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl"
            aria-hidden="true"
          >
            🛎
          </div>
          <p className="text-sm leading-snug text-brand-text-muted">
            {labels.heroLead.replace('{qty}', String(tableQty))}
          </p>
        </div>
      ) : null}
      {labels.paidJustOrdered ? (
        <p className="mb-3 text-sm font-semibold text-emerald-800">{labels.paidJustOrdered}</p>
      ) : null}
      {notice ? <SushiSendGuidanceNotice guidance={notice} lang={lang} className="mb-3" /> : null}
      {groups.length === 0 ? (
        <p className="text-brand-text-muted text-sm">{labels.empty}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => (
            <section key={group.groupKey}>
              {index > 0 || group.submittedTimeLabel ? (
                <BatchTimeDivider label={group.submittedTimeLabel} />
              ) : null}
              <div className="space-y-2">
                {group.lines.map((line) => (
                  <div
                    key={line.key}
                    className="flex items-center justify-between gap-3 text-sm text-brand-text"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <PeerFloatDishThumb thumb={line.thumb} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{line.label}</p>
                        {line.note ? (
                          <p className="mt-0.5 truncate text-[12px] text-brand-text-muted">
                            {line.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {line.editable ? (
                      <CartQtyStepper
                        qty={line.qty}
                        max={APPEND_CART_QTY_MAX}
                        disabled={busyLineId === line.lineId || sendBusy}
                        onDecrement={() => onOwnLineQtyChange(line.lineId, line.qty - 1)}
                        onIncrement={() => onOwnLineQtyChange(line.lineId, line.qty + 1)}
                      />
                    ) : (
                      <span className="shrink-0 min-w-[1.25rem] text-center text-base font-semibold tabular-nums text-brand-text">
                        {line.qty}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {paidSentLines.length > 0 ? (
        <section className="mt-4">
          <BatchTimeDivider label={labels.paidSentTitle} />
          <div className="space-y-2">
            {paidSentLines.map((line) => (
              <div
                key={line.key}
                className="flex items-center justify-between gap-3 text-sm text-brand-text-muted"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <PeerFloatDishThumb thumb={line.thumb} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{line.label}</p>
                    {line.note ? <p className="mt-0.5 truncate text-[12px]">{line.note}</p> : null}
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                  ✓ {line.qty}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {sendError ? (
        <div
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800"
        >
          {sendError}
        </div>
      ) : null}
    </CustomerMenuBottomSheet>
  );
}
