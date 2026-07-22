'use client';

import { PREVIEW_BILL, PREVIEW_TABLE } from '@/lib/landing/preview-data';
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

export function PreviewBillContent({ showLabel = true }: FrameOptions) {
  const { copy } = useLandingPreviewCopy();
  const avg = formatEuro(PREVIEW_BILL.grandTotal / PREVIEW_BILL.guests);

  return (
    <PreviewDeviceFrame
      variant="phone"
      label={`${formatPreviewCopy(copy.shared.tableLabel, {
        name: PREVIEW_TABLE.displayName,
      })}${copy.bill.frameSuffix}`}
      showLabel={showLabel}
    >
      <div className="bg-brand-bg p-4">
        <PreviewSectionTitle>{copy.bill.title}</PreviewSectionTitle>
        <div className="mt-1">
          <PreviewMuted>{copy.bill.subtitle}</PreviewMuted>
        </div>

        <div className="mt-5 space-y-2 rounded-2xl border border-brand-border bg-brand-card p-4 text-[14px]">
          <div className="flex justify-between text-brand-text-muted">
            <span>{copy.bill.buffetFee}</span>
            <span className="text-brand-text">{formatEuro(PREVIEW_BILL.buffetTotal)}</span>
          </div>
          <div className="flex justify-between text-brand-text-muted">
            <span>{copy.bill.drinksTotal}</span>
            <span className="text-brand-text">{formatEuro(PREVIEW_BILL.addOnTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-brand-border pt-2 font-semibold text-brand-text">
            <span>{copy.bill.grandTotal}</span>
            <span className="text-brand-gold">{formatEuro(PREVIEW_BILL.grandTotal)}</span>
          </div>
        </div>

        <p className="mt-5 text-[13px] font-medium text-brand-text">{copy.bill.splitModeTitle}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {copy.bill.splitModes.map((mode, index) => (
            <span
              key={mode}
              className={`rounded-lg px-2 py-2 text-center text-[12px] ${
                index === 0
                  ? 'bg-brand-gold text-brand-on-gold'
                  : 'border border-brand-border text-brand-text-muted'
              }`}
            >
              {mode}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-brand-text-muted">
          {formatPreviewCopy(copy.bill.perGuestSummary, {
            guests: PREVIEW_BILL.guests,
            avg,
          })}
        </p>
        <button
          type="button"
          tabIndex={-1}
          className="mt-5 w-full rounded-xl bg-brand-gold py-3 text-[15px] font-semibold text-brand-on-gold"
        >
          {copy.bill.confirmPayment}
        </button>
      </div>
    </PreviewDeviceFrame>
  );
}

export function PreviewBillScreen() {
  return (
    <PreviewShell title="Bill split preview">
      <PreviewBillContent />
    </PreviewShell>
  );
}
