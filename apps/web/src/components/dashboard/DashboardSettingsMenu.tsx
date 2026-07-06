'use client';

import { useRouter } from 'next/navigation';
import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { PersonalSettingsMenu } from '@/components/staff/PersonalSettingsMenu';

type Props = {
  logoutLabel: string;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DashboardSettingsMenu({
  logoutLabel,
  compact = false,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  return (
    <PersonalSettingsMenu
      logoutLabel={logoutLabel}
      onSignOut={() => dashboardSignOutAndRedirect(router)}
      compact={compact}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
