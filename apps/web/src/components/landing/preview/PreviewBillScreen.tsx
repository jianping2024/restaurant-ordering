import { PREVIEW_BILL, PREVIEW_TABLE } from '@/lib/landing/preview-data';
import {
  PreviewDeviceFrame,
  PreviewMuted,
  PreviewSectionTitle,
  PreviewShell,
  formatEuro,
} from '@/components/landing/preview/PreviewChrome';

const SPLIT_MODES = ['均摊', '按菜分配', '自定义'] as const;

type FrameOptions = {
  showLabel?: boolean;
};

export function PreviewBillContent({ showLabel = true }: FrameOptions) {
  return (
    <PreviewDeviceFrame
      variant="phone"
      label={`桌 ${PREVIEW_TABLE.displayName} · 结账`}
      showLabel={showLabel}
    >
      <div className="bg-brand-bg p-4">
        <PreviewSectionTitle>分单结账</PreviewSectionTitle>
        <div className="mt-1">
          <PreviewMuted>自助餐人头费与加餐分开显示</PreviewMuted>
        </div>

        <div className="mt-5 space-y-2 rounded-2xl border border-brand-border bg-brand-card p-4 text-[14px]">
          <div className="flex justify-between text-brand-text-muted">
            <span>自助餐人头费</span>
            <span className="text-brand-text">{formatEuro(PREVIEW_BILL.buffetTotal)}</span>
          </div>
          <div className="flex justify-between text-brand-text-muted">
            <span>加菜品</span>
            <span className="text-brand-text">{formatEuro(PREVIEW_BILL.addOnTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-brand-border pt-2 font-semibold text-brand-text">
            <span>合计</span>
            <span className="text-brand-gold">{formatEuro(PREVIEW_BILL.grandTotal)}</span>
          </div>
        </div>

        <p className="mt-5 text-[13px] font-medium text-brand-text">分单方式</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SPLIT_MODES.map((mode, index) => (
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
          {PREVIEW_BILL.guests} 位消费者 · 人均{' '}
          {formatEuro(PREVIEW_BILL.grandTotal / PREVIEW_BILL.guests)}
        </p>
        <button
          type="button"
          tabIndex={-1}
          className="mt-5 w-full rounded-xl bg-brand-gold py-3 text-[15px] font-semibold text-brand-on-gold"
        >
          确认收款
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
