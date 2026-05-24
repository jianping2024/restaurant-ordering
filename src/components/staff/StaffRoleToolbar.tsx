'use client';

import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

type Props = {
  exitLabel: string;
  onSignOut: () => void;
};

/** Top-right language + sign-out row shared by kitchen / waiter staff boards. */
export function StaffRoleToolbar({ exitLabel, onSignOut }: Props) {
  return (
    <div className="flex justify-end items-center gap-2 mb-3">
      <LanguageSwitcher compact />
      <button
        type="button"
        onClick={onSignOut}
        className="text-[12px] px-2 py-1 rounded-md border border-brand-border text-brand-text-muted hover:text-brand-text transition-colors"
      >
        {exitLabel}
      </button>
    </div>
  );
}
