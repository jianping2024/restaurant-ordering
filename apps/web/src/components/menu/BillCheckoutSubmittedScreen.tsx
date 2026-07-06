'use client';

import type { CustomerSplitRowDisplay } from '@/lib/customer-bill-split-display';
import type { UILanguage } from '@/lib/i18n';
import type { DishFeedbackVote } from '@/types';
import { CheckoutSubmittedHeroIllustration } from '@/components/menu/CheckoutSubmittedHeroIllustration';
import { CustomerSplitResultList } from '@/components/menu/CustomerSplitResultList';
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
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
  staffAssisted?: StaffAssistedFlow | null;
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
  staffAssisted = null,
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
      <CustomerOrderingHeader
        restaurantName={restaurantName}
        displayName={displayName}
        tableLabel={tableLabel}
        staffAssisted={staffAssisted}
        headingSize="bill"
      />

      <main className="px-4 py-6 space-y-4">
        <section className="pt-2 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <CheckoutSubmittedHeroIllustration />
          </div>
          <p className="font-heading text-lg text-brand-gold leading-snug px-1">{copy.checkoutSubmittedHint}</p>
        </section>

        <section className="bg-brand-card border border-brand-border rounded-xl px-4 py-5 text-center">
          <p className="text-[13px] text-brand-text-muted">{copy.totalLabel}</p>
          <p className="font-heading text-3xl text-brand-gold mt-1">€{total.toFixed(2)}</p>
        </section>

        <CustomerSplitResultList
          rows={splitRows}
          lang={lang}
          copy={{
            splitResult: copy.splitResult,
            splitPaid: copy.splitPaid,
            splitPartialPaid: copy.splitPartialPaid,
            splitAmountBreakdown: copy.splitAmountBreakdown,
          }}
        />

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
