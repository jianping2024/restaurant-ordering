'use client';

import type { ReactNode } from 'react';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { DashboardTopBar } from '@/components/dashboard/DashboardTopBar';

type Props = {
  restaurant: DashboardNavRestaurant;
  accessMode: DashboardAccessMode;
  children: ReactNode;
};

export function DashboardShell({ restaurant, accessMode, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
      <DashboardTopBar restaurant={restaurant} accessMode={accessMode} />
      <main className="min-h-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
