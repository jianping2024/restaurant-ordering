'use client';

import type { CustomerSplitRowDisplay } from '@/lib/customer-bill-split-display';
import { localizeSplitPersonName } from '@/lib/split-person-label';
import type { UILanguage } from '@/lib/i18n';
import type { DishFeedbackVote } from '@/types';
import { CustomerTableHeader } from '@/components/menu/CustomerTableHeader';
import { Button, ButtonLink } from '@/components/ui/Button';

type FeedbackReasonKey = 'taste' | 'temp' | 'slow' | 'mismatch' | 'other';

type ReviewableItem = {
  menu_item_id: string;
  name: string;
  emoji: string;
  qty: number;
};

export type BillCheckoutSubmittedCopy = {
  checkoutSubmittedHint: string;
  totalLabel: string;
  splitResult: string;
  splitPaid: string;
  splitPartialPaid: string;
  splitAmountBreakdown: string;
  refreshPage: string;
  feedbackTitle: string;
  feedbackHint: string;
  feedbackSkip: string;
  feedbackSubmit: string;
  feedbackThanks: string;
  thumbsUp: string;
  thumbsDown: string;
  noFeedbackItems: string;
};

interface Props {
  restaurantName: string;
  displayName: string;
  tableLabel: string;
  lang: UILanguage;
  copy: BillCheckoutSubmittedCopy;
  total: number;
  splitRows: CustomerSplitRowDisplay[];
  backHref: string;
  backLabel: string;
  onRefreshPage: () => void;
  showFeedback: boolean;
  reviewableItems: ReviewableItem[];
  feedbackDraft: Record<string, { vote?: DishFeedbackVote; reasons: FeedbackReasonKey[] }>;
  feedbackReasonLabels: Record<FeedbackReasonKey, string>;
  feedbackReasonKeys: readonly FeedbackReasonKey[];
  feedbackHydrating: boolean;
  feedbackSubmitted: boolean;
  feedbackSubmitting: boolean;
  selectedFeedbackCount: number;
  onVote: (menuItemId: string, vote: DishFeedbackVote) => void;
  onToggleReason: (menuItemId: string, reason: FeedbackReasonKey) => void;
  onSkipFeedback: () => void;
  onSubmitFeedback: () => void;
}

function SplitRowsCard({
  rows,
  lang,
  copy,
}: {
  rows: CustomerSplitRowDisplay[];
  lang: UILanguage;
  copy: BillCheckoutSubmittedCopy;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
      <p className="px-4 py-2.5 text-[13px] text-brand-text-muted border-b border-brand-border">
        {copy.splitResult}
      </p>
      {rows.map((row, i) => (
        <div key={i} className="px-4 py-3 border-b border-brand-border last:border-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-brand-text text-sm">{localizeSplitPersonName(row.name, lang)}</span>
                {row.settlementStatus === 'settled' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full mesa-badge-success">{copy.splitPaid}</span>
                ) : null}
                {row.settlementStatus === 'partial' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-brand-gold/40 text-brand-gold">
                    {copy.splitPartialPaid}
                  </span>
                ) : null}
              </div>
              {row.settlementStatus === 'partial' ? (
                <p className="mt-1 text-[12px] text-brand-text-muted">
                  {copy.splitAmountBreakdown
                    .replace('{obligation}', row.obligationAmount.toFixed(2))
                    .replace('{collected}', row.collectedAmount.toFixed(2))}
                </p>
              ) : null}
            </div>
            <span className="text-brand-gold font-medium shrink-0">
              €{(row.settlementStatus === 'partial' ? row.outstandingAmount : row.obligationAmount).toFixed(2)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BillCheckoutSubmittedScreen({
  restaurantName,
  displayName,
  tableLabel,
  lang,
  copy,
  total,
  splitRows,
  backHref,
  backLabel,
  onRefreshPage,
  showFeedback,
  reviewableItems,
  feedbackDraft,
  feedbackReasonLabels,
  feedbackReasonKeys,
  feedbackHydrating,
  feedbackSubmitted,
  feedbackSubmitting,
  selectedFeedbackCount,
  onVote,
  onToggleReason,
  onSkipFeedback,
  onSubmitFeedback,
}: Props) {
  return (
    <div className="min-h-screen bg-brand-bg max-w-mobile mx-auto pb-8">
      <CustomerTableHeader
        restaurantName={restaurantName}
        displayName={displayName}
        tableLabel={tableLabel}
      />

      <main className="px-4 py-6 space-y-4">
        <section className="pt-2 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-gold/10 border border-brand-gold/25"
            aria-hidden
          >
            <span className="text-2xl">🧾</span>
          </div>
          <p className="font-heading text-lg text-brand-gold leading-snug px-1">{copy.checkoutSubmittedHint}</p>
        </section>

        <section className="bg-brand-card border border-brand-border rounded-xl px-4 py-5 text-center">
          <p className="text-[13px] text-brand-text-muted">{copy.totalLabel}</p>
          <p className="font-heading text-3xl text-brand-gold mt-1">€{total.toFixed(2)}</p>
        </section>

        <SplitRowsCard rows={splitRows} lang={lang} copy={copy} />

        <section className="grid grid-cols-2 gap-3 pt-1">
          <Button type="button" variant="gold" size="action" className="w-full" onClick={onRefreshPage}>
            {copy.refreshPage}
          </Button>
          <ButtonLink variant="outline" size="action" className="w-full" href={backHref}>
            ← {backLabel}
          </ButtonLink>
        </section>

        {showFeedback ? (
          <section className="bg-brand-card border border-brand-border rounded-xl p-4">
            <h3 className="text-brand-text font-medium">{copy.feedbackTitle}</h3>
            <p className="text-brand-text-muted text-[13px] mt-1">{copy.feedbackHint}</p>
            {reviewableItems.length === 0 ? (
              <p className="mt-3 text-[13px] text-brand-text-muted">{copy.noFeedbackItems}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {reviewableItems.map((item) => {
                  const draft = feedbackDraft[item.menu_item_id];
                  const reasons = draft?.reasons ?? [];
                  return (
                    <div key={item.menu_item_id} className="rounded-lg border border-brand-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-brand-text">
                          {item.emoji} {item.name} × {item.qty}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onVote(item.menu_item_id, 'up')}
                            className={`text-[13px] px-2.5 py-1 rounded-full border transition-colors ${
                              draft?.vote === 'up'
                                ? 'mesa-badge-success'
                                : 'border-brand-border text-brand-text-muted hover:text-brand-text'
                            }`}
                          >
                            👍 {copy.thumbsUp}
                          </button>
                          <button
                            type="button"
                            onClick={() => onVote(item.menu_item_id, 'down')}
                            className={`text-[13px] px-2.5 py-1 rounded-full border transition-colors ${
                              draft?.vote === 'down'
                                ? 'mesa-badge-danger'
                                : 'border-brand-border text-brand-text-muted hover:text-brand-text'
                            }`}
                          >
                            👎 {copy.thumbsDown}
                          </button>
                        </div>
                      </div>
                      {draft?.vote === 'down' ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {feedbackReasonKeys.map((reason) => (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => onToggleReason(item.menu_item_id, reason)}
                              className={`text-[13px] px-2 py-0.5 rounded-full border ${
                                reasons.includes(reason)
                                  ? 'mesa-badge-warning'
                                  : 'border-brand-border text-brand-text-muted hover:text-brand-text'
                              }`}
                            >
                              {feedbackReasonLabels[reason]}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {feedbackSubmitted ? (
              <p className="mt-3 text-[13px] text-brand-text">{copy.feedbackThanks}</p>
            ) : null}

            {!feedbackHydrating && !feedbackSubmitted && reviewableItems.length > 0 ? (
              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void onSkipFeedback()}
                  loading={feedbackSubmitting}
                  disabled={feedbackSubmitting}
                >
                  {copy.feedbackSkip}
                </Button>
                <Button
                  onClick={() => void onSubmitFeedback()}
                  loading={feedbackSubmitting}
                  disabled={feedbackSubmitting || selectedFeedbackCount === 0}
                >
                  {copy.feedbackSubmit}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
