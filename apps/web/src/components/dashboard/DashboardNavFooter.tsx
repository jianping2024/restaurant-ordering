'use client';

import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface DashboardNavFooterProps {
  logoutLabel: string;
  onLogout: () => void;
  collapsed: boolean;
}

export function DashboardNavFooter({ logoutLabel, onLogout, collapsed }: DashboardNavFooterProps) {
  if (collapsed) {
    return (
      <div className="shrink-0 overflow-visible border-t border-brand-border px-2 py-3">
        <div className="flex flex-col items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher variant="icon" menuSide="right" />
          <button
            type="button"
            onClick={onLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-brand-bg text-sm text-brand-text-muted transition-colors hover:border-brand-gold/40 hover:text-status-danger"
            title={logoutLabel}
            aria-label={logoutLabel}
          >
            <span aria-hidden>🚪</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-brand-border px-4 py-3">
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher variant="icon" />
        <button
          type="button"
          onClick={onLogout}
          className="ml-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-text-muted transition-all hover:bg-[rgb(var(--color-status-danger-border)/0.12)] hover:text-status-danger"
        >
          <span aria-hidden>🚪</span>
          <span>{logoutLabel}</span>
        </button>
      </div>
    </div>
  );
}
