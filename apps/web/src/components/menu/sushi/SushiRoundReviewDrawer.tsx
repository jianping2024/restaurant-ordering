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
  empty: string;
  /** Dismiss while the round can still be sent (先不送厨). */
  notYet: string;
  continueOrdering: string;
  sendRound: string;
  paidSentTitle: string;
};

type Props = {
  open: boolean;
  groups: RoundReviewGroup[];
  labels: Labels;
  /** Read-only paid rows already sent this round (never sent again, not counted). */
  paidSentLines: RoundReviewPaidSentLine[];
  /** Same live guidance as the footer strip (unsent / countdown / failed). */
  guidance: SushiSendGuidance | null;
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
  paidSentLines,
  guidance,
  lang,
  canSend,
  sendBusy,
  countdownActive,
  busyLineId,
  onClose,
  onSend,
  onOwnLineQtyChange,
}: Props) {
  const notice = guidance && guidance.kind !== 'sent' ? guidance : null;

  return (
    <CustomerMenuBottomSheet
      open={open}
      onClose={onClose}
      title={labels.title}
      footer={
        <div className="flex items-stretch gap-3">
          <Button
            type="button"
            variant="outline"
            size="action"
            className="min-w-0 flex-1 whitespace-nowrap"
            onClick={onClose}
          >
            {canSend ? labels.notYet : labels.continueOrdering}
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
            {labels.sendRound}
          </Button>
        </div>
      }
    >
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
    </CustomerMenuBottomSheet>
  );
}
