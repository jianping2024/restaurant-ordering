'use client';

import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  return (
    <PersonalSettingsMenu
      roleLabel={roleLabel}
      logoutLabel={logoutLabel}
      onSignOut={() => dashboardSignOutAndRedirect(router)}
      compact={compact}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
