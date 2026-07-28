'use client';

import type { ReactNode } from 'react';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { DashboardTopBar } from '@/components/dashboard/DashboardTopBar';
import { STAFF_SHELL_MAIN_CLASS } from '@/lib/staff-shell-layout';
import type { CapabilitiesPayload } from '@/lib/permissions/can';

type Props = {
  restaurant: DashboardNavRestaurant;
  accessMode: DashboardAccessMode;
  capabilities: CapabilitiesPayload;
  children: ReactNode;
};

export function DashboardShell({ restaurant, accessMode, capabilities, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
      <DashboardTopBar
        restaurant={restaurant}
        accessMode={accessMode}
        capabilities={capabilities}
      />
      <main className={STAFF_SHELL_MAIN_CLASS}>{children}</main>
    </div>
  );
}
