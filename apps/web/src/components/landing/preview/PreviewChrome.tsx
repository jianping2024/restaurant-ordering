import type { ReactNode } from 'react';

type PreviewShellProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function PreviewShell({ title, children, className = '' }: PreviewShellProps) {
  return (
    <div className={`min-h-screen bg-brand-bg text-brand-text ${className}`.trim()}>
      <div className="border-b border-brand-gold/25 bg-brand-gold/8 px-4 py-2 text-center text-[12px] tracking-wide text-brand-gold">
        界面预览 · MesaGo 演示数据
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      <p className="sr-only">{title}</p>
    </div>
  );
}

type PreviewDeviceFrameProps = {
  children: ReactNode;
  label?: string;
  variant?: 'phone' | 'tablet' | 'desktop';
  showLabel?: boolean;
};

const FRAME_CLASS = {
  phone: 'max-w-[390px]',
  tablet: 'max-w-[768px]',
  desktop: 'max-w-[1100px]',
} as const;

export function PreviewDeviceFrame({
  children,
  label,
  variant = 'phone',
  showLabel = true,
}: PreviewDeviceFrameProps) {
  return (
    <div className={`mx-auto w-full ${FRAME_CLASS[variant]}`}>
      {showLabel && label ? (
        <p className="mb-2 text-center text-[12px] uppercase tracking-[0.14em] text-brand-text-muted">
          {label}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-card shadow-[0_24px_60px_-32px_rgba(62,39,35,0.35)]">
        {children}
      </div>
    </div>
  );
}

export function PreviewSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-heading text-xl text-brand-text sm:text-2xl">{children}</h2>
  );
}

export function PreviewMuted({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-brand-text-muted">{children}</p>;
}

export function PreviewStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-bg px-4 py-3">
      <p className="text-[12px] text-brand-text-muted">{label}</p>
      <p className="mt-1 font-heading text-2xl text-brand-gold">{value}</p>
    </div>
  );
}

export function formatEuro(amount: number): string {
  return `€${amount.toFixed(2)}`;
}
