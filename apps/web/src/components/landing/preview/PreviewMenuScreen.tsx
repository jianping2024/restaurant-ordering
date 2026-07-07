import {
  PREVIEW_MENU_ITEMS,
  PREVIEW_RESTAURANT_NAME,
  PREVIEW_TABLE,
} from '@/lib/landing/preview-data';
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
  const cartTotal = PREVIEW_MENU_ITEMS.slice(0, 2).reduce((sum, item) => sum + item.price, 0);

  return (
    <PreviewDeviceFrame
      variant="phone"
      label={`桌 ${PREVIEW_TABLE.displayName}`}
      showLabel={showLabel}
    >
      <div className="bg-brand-bg">
        <div className="border-b border-brand-border px-4 py-4">
          <p className="font-heading text-lg text-brand-text">{PREVIEW_RESTAURANT_NAME}</p>
          <PreviewMuted>扫码加餐 · 三语菜单</PreviewMuted>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {['主菜', '饮品'].map((cat, index) => (
            <span
              key={cat}
              className={`rounded-full px-3 py-1 text-[13px] ${
                index === 0
                  ? 'bg-brand-gold text-brand-on-gold'
                  : 'border border-brand-border text-brand-text-muted'
              }`}
            >
              {cat}
            </span>
          ))}
        </div>
        <div className="space-y-3 px-4 pb-4">
          {PREVIEW_MENU_ITEMS.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-card px-3 py-3"
            >
              <div>
                <p className="font-medium text-brand-text">{item.name}</p>
                <p className="text-[12px] text-brand-text-muted">{item.category}</p>
              </div>
              <div className="text-right">
                <p className="text-brand-gold">{formatEuro(item.price)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-brand-border bg-brand-card px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-brand-text-muted">购物车 2 道菜</span>
            <span className="font-semibold text-brand-gold">{formatEuro(cartTotal)}</span>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="mt-3 w-full rounded-xl bg-brand-gold py-3 text-[15px] font-semibold text-brand-on-gold"
          >
            提交订单
          </button>
        </div>
      </div>
    </PreviewDeviceFrame>
  );
}

export function PreviewMenuScreen() {
  return (
    <PreviewShell title="Customer menu preview">
      <PreviewMenuContent />
    </PreviewShell>
  );
}
