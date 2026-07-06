'use client';

import { useRouter } from 'next/navigation';
import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { PersonalSettingsMenu } from '@/components/staff/PersonalSettingsMenu';

type Props = {
  logoutLabel: string;
};

export function DashboardSettingsMenu({ logoutLabel }: Props) {
  const router = useRouter();
  return (
    <PersonalSettingsMenu
      logoutLabel={logoutLabel}
      onSignOut={() => dashboardSignOutAndRedirect(router)}
    />
  );
}
