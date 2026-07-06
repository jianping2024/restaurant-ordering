'use client';

import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { StaffSignOutControl } from '@/components/staff/StaffSignOutControl';

type Props = {
  exitLabel: string;
  onSignOut: () => void;
  /** When false, runs immediately (e.g. owner returning to dashboard). Default true. */
  confirmSignOut?: boolean;
  className?: string;
};

/** Top-right language + sign-out row shared by kitchen / waiter staff boards. */
export function StaffRoleToolbar({
  exitLabel,
  onSignOut,
  confirmSignOut = true,
  className = 'mb-3',
}: Props) {
  return (
    <div className={`flex justify-end items-center gap-2 ${className}`}>
      <LanguageSwitcher compact />
      <StaffSignOutControl
        exitLabel={exitLabel}
        onSignOut={onSignOut}
        confirmSignOut={confirmSignOut}
      />
    </div>
  );
}
