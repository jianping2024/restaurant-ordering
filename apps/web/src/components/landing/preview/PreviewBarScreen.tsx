'use client';

import { PREVIEW_BAR_ORDERS, getPreviewMenuItem } from '@/lib/landing/preview-data';
import { formatPreviewCopy } from '@/lib/landing/preview-copy';
import { useLandingPreviewCopy } from '@/lib/landing/use-landing-preview-copy';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import {
  PreviewDeviceFrame,
  PreviewSectionTitle,
  PreviewShell,
} from '@/components/landing/preview/PreviewChrome';

const STATUS_CLASS = {
  pending: 'bg-amber-500/15 text-amber-700',
  preparing: 'bg-brand-gold/15 text-brand-gold',
} as const;

type FrameOptions = {
  showLabel?: boolean;
};

export function PreviewBarContent({ showLabel = true }: FrameOptions) {
  const { lang, copy } = useLandingPreviewCopy();

  return (
    <PreviewDeviceFrame
      variant="desktop"
      label={copy.shared.restaurantName}
      showLabel={showLabel}
    >
      <div className="bg-brand-bg p-5">
        <div className="mb-5 flex items-center justify-between">
          <PreviewSectionTitle>{copy.bar.title}</PreviewSectionTitle>
          <span className="text-[13px] text-brand-text-muted">{copy.bar.subtitle}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PREVIEW_BAR_ORDERS.map((order) => (
            <article
              key={order.table}
              className="rounded-2xl border border-brand-border bg-brand-card p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-heading text-2xl text-brand-text">
                  {formatPreviewCopy(copy.shared.tableLabel, { name: order.table })}
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-[12px] font-medium ${STATUS_CLASS[order.status]}`}
                >
                  {copy.bar.status[order.status]}
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {order.lines.map((line) => {
                  const item = getPreviewMenuItem(line.code);
                  const name = item
                    ? resolveMenuItemLocalizedName(item, lang)
                    : line.code;
                  return (
                    <li
                      key={`${order.table}-${line.code}`}
                      className="flex items-center justify-between rounded-lg bg-brand-bg px-3 py-2 text-[14px]"
                    >
                      <span className="text-brand-text">
                        {formatPreviewCopy(copy.bar.lineQty, { name, qty: line.qty })}
                      </span>
                      <span className="rounded-md border border-brand-border px-2 py-1 text-[12px] text-brand-text-muted">
                        {copy.bar.doneBadge}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </PreviewDeviceFrame>
  );
}

export function PreviewBarScreen() {
  return (
    <PreviewShell title="Bar display preview">
      <PreviewBarContent />
    </PreviewShell>
  );
}
