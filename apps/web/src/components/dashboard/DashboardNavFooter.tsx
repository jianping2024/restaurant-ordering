'use client';

import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface DashboardNavFooterProps {
  systemSettingsLabel: string;
  logoutLabel: string;
  onLogout: () => void;
}

export function DashboardNavFooter({
  systemSettingsLabel,
  logoutLabel,
  onLogout,
}: DashboardNavFooterProps) {
  return (
    <div className="shrink-0 border-t border-brand-border px-4 py-3">
      <p className="mb-2 px-1 text-xs font-medium tracking-wide text-brand-text-muted">
        {systemSettingsLabel}
      </p>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher variant="menu" />
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] leading-6 text-brand-text-muted transition-all hover:bg-[rgb(var(--color-status-danger-border)/0.12)] hover:text-status-danger"
      >
        <span>🚪</span>
        {logoutLabel}
      </button>
    </div>
  );
}
