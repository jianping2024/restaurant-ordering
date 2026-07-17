'use client';

import type { ReactNode } from 'react';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { DashboardTopBar } from '@/components/dashboard/DashboardTopBar';
import { STAFF_SHELL_MAIN_CLASS } from '@/lib/staff-shell-layout';

type Props = {
  restaurant: DashboardNavRestaurant;
  accessMode: DashboardAccessMode;
  children: ReactNode;
};

export function DashboardShell({ restaurant, accessMode, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
      <DashboardTopBar restaurant={restaurant} accessMode={accessMode} />
      <main className={STAFF_SHELL_MAIN_CLASS}>{children}</main>
    </div>
  );
}
