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
          className="ml-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-text-muted transition-all hover:bg-[rgb(var(--color-status-danger-border)/0.12)] hover:text-status-danger"
        >
          <span aria-hidden>🚪</span>
          <span>{logoutLabel}</span>
        </button>
      </div>
    </div>
  );
}
