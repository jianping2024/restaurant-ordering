'use client';

import type { ReactNode } from 'react';
import type { DashboardNavRestaurant, DashboardShellMode } from '@/lib/dashboard-access';
import { DashboardTopBar } from '@/components/dashboard/DashboardTopBar';
import { STAFF_SHELL_CONTENT_CLASS, STAFF_SHELL_MAIN_CLASS } from '@/lib/staff-shell-layout';
import type { CapabilitiesPayload } from '@/lib/permissions/can';

type Props = {
  restaurant: DashboardNavRestaurant;
  shellMode: DashboardShellMode;
  roleLabel?: string;
  capabilities: CapabilitiesPayload;
  children: ReactNode;
};

export function DashboardShell({ restaurant, shellMode, roleLabel, capabilities, children }: Props) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-brand-bg">
      <DashboardTopBar
        restaurant={restaurant}
        shellMode={shellMode}
        roleLabel={roleLabel}
        capabilities={capabilities}
      />
      <main className={STAFF_SHELL_MAIN_CLASS}>
        <div className={STAFF_SHELL_CONTENT_CLASS}>{children}</div>
      </main>
    </div>
  );
}
