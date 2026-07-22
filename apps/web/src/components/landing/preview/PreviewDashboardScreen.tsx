'use client';

import { PREVIEW_DASHBOARD, getPreviewMenuItem } from '@/lib/landing/preview-data';
import { useLandingPreviewCopy } from '@/lib/landing/use-landing-preview-copy';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import {
  PreviewDeviceFrame,
  PreviewSectionTitle,
  PreviewShell,
  PreviewStatCard,
  formatEuro,
} from '@/components/landing/preview/PreviewChrome';

type FrameOptions = {
  showLabel?: boolean;
};

export function PreviewDashboardContent({ showLabel = true }: FrameOptions) {
  const { lang, copy } = useLandingPreviewCopy();

  return (
    <PreviewDeviceFrame
      variant="desktop"
      label={copy.shared.restaurantName}
      showLabel={showLabel}
    >
      <div className="bg-brand-bg p-5">
        <PreviewSectionTitle>{copy.dashboard.title}</PreviewSectionTitle>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <PreviewStatCard
            label={copy.dashboard.todayOrders}
            value={String(PREVIEW_DASHBOARD.todayOrders)}
          />
          <PreviewStatCard
            label={copy.dashboard.todayRevenue}
            value={formatEuro(PREVIEW_DASHBOARD.todayRevenue)}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-brand-border bg-brand-card p-4">
          <p className="text-[13px] font-medium text-brand-text">{copy.dashboard.topDrinksTitle}</p>
          <table className="mt-3 w-full text-left text-[14px]">
            <thead>
              <tr className="text-brand-text-muted">
                <th className="pb-2 font-medium">{copy.dashboard.drinkColumn}</th>
                <th className="pb-2 text-right font-medium">{copy.dashboard.qtyColumn}</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_DASHBOARD.topItems.map((row, index) => {
                const item = getPreviewMenuItem(row.code);
                const name = item
                  ? resolveMenuItemLocalizedName(item, lang)
                  : row.code;
                return (
                  <tr key={row.code} className="border-t border-brand-border">
                    <td className="py-2 text-brand-text">
                      <span className="mr-2 text-brand-gold">{index + 1}</span>
                      {name}
                    </td>
                    <td className="py-2 text-right text-brand-text-muted">{row.qty}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PreviewDeviceFrame>
  );
}

export function PreviewDashboardScreen() {
  return (
    <PreviewShell title="Dashboard preview">
      <PreviewDashboardContent />
    </PreviewShell>
  );
}
