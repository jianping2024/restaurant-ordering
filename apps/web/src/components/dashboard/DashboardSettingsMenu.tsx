'use client';

import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { PersonalSettingsMenu } from '@/components/staff/PersonalSettingsMenu';

type Props = {
  roleLabel: string;
  logoutLabel: string;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DashboardSettingsMenu({
  roleLabel,
  logoutLabel,
  compact = false,
  open,
  onOpenChange,
}: Props) {
  return (
    <PersonalSettingsMenu
      roleLabel={roleLabel}
      logoutLabel={logoutLabel}
      onSignOut={() => void dashboardSignOutAndRedirect()}
      compact={compact}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
