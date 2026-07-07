import { PREVIEW_DASHBOARD, PREVIEW_RESTAURANT_NAME } from '@/lib/landing/preview-data';
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
  return (
    <PreviewDeviceFrame variant="desktop" label={PREVIEW_RESTAURANT_NAME} showLabel={showLabel}>
      <div className="bg-brand-bg p-5">
        <PreviewSectionTitle>数据概览</PreviewSectionTitle>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <PreviewStatCard label="今日订单" value={String(PREVIEW_DASHBOARD.todayOrders)} />
          <PreviewStatCard
            label="今日营业额"
            value={formatEuro(PREVIEW_DASHBOARD.todayRevenue)}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-brand-border bg-brand-card p-4">
          <p className="text-[13px] font-medium text-brand-text">今日热销酒水</p>
          <table className="mt-3 w-full text-left text-[14px]">
            <thead>
              <tr className="text-brand-text-muted">
                <th className="pb-2 font-medium">酒水</th>
                <th className="pb-2 text-right font-medium">销量</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_DASHBOARD.topItems.map((item, index) => (
                <tr key={item.name} className="border-t border-brand-border">
                  <td className="py-2 text-brand-text">
                    <span className="mr-2 text-brand-gold">{index + 1}</span>
                    {item.name}
                  </td>
                  <td className="py-2 text-right text-brand-text-muted">{item.qty}</td>
                </tr>
              ))}
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
