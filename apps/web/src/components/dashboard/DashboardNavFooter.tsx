'use client';

import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface DashboardNavFooterProps {
  logoutLabel: string;
  onLogout: () => void;
}

export function DashboardNavFooter({ logoutLabel, onLogout }: DashboardNavFooterProps) {
  return (
    <div className="shrink-0 border-t border-brand-border px-4 py-3">
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher variant="icon" />
        <button
          type="button"
          onClick={onLogout}
          aria-label={logoutLabel}
          className="group ml-auto flex items-center gap-0 overflow-hidden rounded-xl px-2 py-2 text-sm text-brand-text-muted transition-all hover:gap-2 hover:px-3 hover:bg-[rgb(var(--color-status-danger-border)/0.12)] hover:text-status-danger"
        >
          <span aria-hidden>🚪</span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[4.5rem] group-hover:opacity-100">
            {logoutLabel}
          </span>
        </button>
      </div>
    </div>
  );
}
