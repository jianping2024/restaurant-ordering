'use client';

import { PREVIEW_TABLE } from '@/lib/landing/preview-data';
import { formatPreviewCopy } from '@/lib/landing/preview-copy';
import { useLandingPreviewCopy } from '@/lib/landing/use-landing-preview-copy';
import {
  PreviewDeviceFrame,
  PreviewMuted,
  PreviewSectionTitle,
  PreviewShell,
  formatEuro,
} from '@/components/landing/preview/PreviewChrome';

type FrameOptions = {
  showLabel?: boolean;
};

export function PreviewWaiterOpenContent({ showLabel = true }: FrameOptions) {
  const { copy } = useLandingPreviewCopy();
  const estimated =
    PREVIEW_TABLE.adults * PREVIEW_TABLE.adultPrice +
    PREVIEW_TABLE.children * PREVIEW_TABLE.childPrice;

  return (
    <PreviewDeviceFrame
      variant="tablet"
      label={copy.shared.restaurantName}
      showLabel={showLabel}
    >
      <div className="bg-brand-bg p-5">
        <div className="flex items-center justify-between border-b border-brand-border pb-4">
          <div>
            <PreviewSectionTitle>
              {formatPreviewCopy(copy.shared.tableLabel, { name: PREVIEW_TABLE.displayName })}
            </PreviewSectionTitle>
            <PreviewMuted>{copy.waiterOpen.roleHint}</PreviewMuted>
          </div>
          <span className="rounded-full bg-brand-gold/15 px-3 py-1 text-[12px] font-medium text-brand-gold">
            {copy.waiterOpen.diningStatus}
          </span>
        </div>

        <div className="mt-5 rounded-2xl border border-brand-border bg-brand-card p-4">
          <p className="text-[13px] font-medium text-brand-gold">{copy.waiterOpen.buffetName}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-brand-border bg-brand-bg px-3 py-3">
              <span className="text-[12px] text-brand-text-muted">{copy.waiterOpen.adultsLabel}</span>
              <p className="mt-1 text-2xl font-semibold text-brand-text">{PREVIEW_TABLE.adults}</p>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-bg px-3 py-3">
              <span className="text-[12px] text-brand-text-muted">{copy.waiterOpen.childrenLabel}</span>
              <p className="mt-1 text-2xl font-semibold text-brand-text">{PREVIEW_TABLE.children}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-[13px] text-brand-text-muted">
            <div className="flex justify-between">
              <span>{copy.waiterOpen.adultPriceLabel}</span>
              <span className="text-brand-text">{formatEuro(PREVIEW_TABLE.adultPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span>{copy.waiterOpen.childPriceLabel}</span>
              <span className="text-brand-text">{formatEuro(PREVIEW_TABLE.childPrice)}</span>
            </div>
            <div className="flex justify-between border-t border-brand-border pt-2 font-medium text-brand-text">
              <span>{copy.waiterOpen.estimatedTotalLabel}</span>
              <span className="text-brand-gold">{formatEuro(estimated)}</span>
            </div>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="mt-5 w-full rounded-xl bg-brand-gold py-3 text-[15px] font-semibold text-brand-on-gold"
          >
            {copy.waiterOpen.confirmOpen}
          </button>
        </div>
      </div>
    </PreviewDeviceFrame>
  );
}

export function PreviewWaiterOpenScreen() {
  return (
    <PreviewShell title="Waiter open table preview">
      <PreviewWaiterOpenContent />
    </PreviewShell>
  );
}
