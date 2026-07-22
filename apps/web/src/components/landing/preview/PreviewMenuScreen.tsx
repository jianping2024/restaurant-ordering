'use client';

import {
  PREVIEW_CART_LINES,
  PREVIEW_CART_TOTAL,
  PREVIEW_MENU_CATEGORIES,
  PREVIEW_MENU_PHONE_ITEMS,
  PREVIEW_TABLE,
} from '@/lib/landing/preview-data';
import { formatPreviewCopy } from '@/lib/landing/preview-copy';
import { useLandingPreviewCopy } from '@/lib/landing/use-landing-preview-copy';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import {
  PreviewDeviceFrame,
  PreviewMuted,
  PreviewShell,
  formatEuro,
} from '@/components/landing/preview/PreviewChrome';

type FrameOptions = {
  showLabel?: boolean;
};

export function PreviewMenuContent({ showLabel = true }: FrameOptions) {
  const { lang, copy } = useLandingPreviewCopy();

  return (
    <PreviewDeviceFrame
      variant="phone"
      label={formatPreviewCopy(copy.shared.tableLabel, { name: PREVIEW_TABLE.displayName })}
      showLabel={showLabel}
    >
      <div className="bg-brand-bg">
        <div className="border-b border-brand-border px-4 py-4">
          <p className="font-heading text-lg text-brand-text">{copy.shared.restaurantName}</p>
          <PreviewMuted>
            {formatPreviewCopy(copy.menu.subtitle, { outlet: copy.menu.outletBar })}
          </PreviewMuted>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {PREVIEW_MENU_CATEGORIES.map((cat, index) => (
            <span
              key={cat}
              className={`rounded-full px-3 py-1 text-[13px] ${
                index === 0
                  ? 'bg-brand-gold text-brand-on-gold'
                  : 'border border-brand-border text-brand-text-muted'
              }`}
            >
              {copy.menu.categories[cat]}
            </span>
          ))}
        </div>
        <div className="space-y-3 px-4 pb-4">
          {PREVIEW_MENU_PHONE_ITEMS.map((item) => (
            <div
              key={item.code}
              className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-card px-3 py-3"
            >
              <div>
                <p className="font-medium text-brand-text">
                  {resolveMenuItemLocalizedName(item, lang)}
                </p>
                <p className="text-[12px] text-brand-text-muted">
                  {copy.menu.categories[item.category]}
                </p>
              </div>
              <div className="text-right">
                <p className="text-brand-gold">{formatEuro(item.price)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-brand-border bg-brand-card px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-brand-text-muted">
              {formatPreviewCopy(copy.menu.cartSummary, { count: PREVIEW_CART_LINES.length })}
            </span>
            <span className="font-semibold text-brand-gold">{formatEuro(PREVIEW_CART_TOTAL)}</span>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="mt-3 w-full rounded-xl bg-brand-gold py-3 text-[15px] font-semibold text-brand-on-gold"
          >
            {copy.menu.submitOrder}
          </button>
        </div>
      </div>
    </PreviewDeviceFrame>
  );
}

export function PreviewMenuScreen() {
  return (
    <PreviewShell title="Drinks menu preview">
      <PreviewMenuContent />
    </PreviewShell>
  );
}
