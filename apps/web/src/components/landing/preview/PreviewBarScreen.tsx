import { PREVIEW_BAR_ORDERS, PREVIEW_RESTAURANT_NAME } from '@/lib/landing/preview-data';
import {
  PreviewDeviceFrame,
  PreviewSectionTitle,
  PreviewShell,
} from '@/components/landing/preview/PreviewChrome';

const STATUS_LABEL = {
  pending: '待出单',
  preparing: '制作中',
} as const;

const STATUS_CLASS = {
  pending: 'bg-amber-500/15 text-amber-700',
  preparing: 'bg-brand-gold/15 text-brand-gold',
} as const;

type FrameOptions = {
  showLabel?: boolean;
};

export function PreviewBarContent({ showLabel = true }: FrameOptions) {
  return (
    <PreviewDeviceFrame variant="desktop" label={PREVIEW_RESTAURANT_NAME} showLabel={showLabel}>
      <div className="bg-brand-bg p-5">
        <div className="mb-5 flex items-center justify-between">
          <PreviewSectionTitle>吧台看板</PreviewSectionTitle>
          <span className="text-[13px] text-brand-text-muted">酒水订单</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PREVIEW_BAR_ORDERS.map((order) => (
            <article
              key={order.table}
              className="rounded-2xl border border-brand-border bg-brand-card p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-heading text-2xl text-brand-text">桌 {order.table}</p>
                <span
                  className={`rounded-full px-3 py-1 text-[12px] font-medium ${STATUS_CLASS[order.status]}`}
                >
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {order.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center justify-between rounded-lg bg-brand-bg px-3 py-2 text-[14px]"
                  >
                    <span className="text-brand-text">{item}</span>
                    <span className="rounded-md border border-brand-border px-2 py-1 text-[12px] text-brand-text-muted">
                      已出
                    </span>
                  </li>
                ))}
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
