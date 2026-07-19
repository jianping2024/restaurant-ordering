'use client';

import type { ReactNode } from 'react';
import { notFound, usePathname } from 'next/navigation';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import type { FloorBoardRole } from '@/lib/floor-board-capabilities';
import {
  dashboardWaiterTableIdFromPath,
  isDashboardWaiterBoardListPath,
  isDashboardWaiterTableDetailPath,
} from '@/lib/dashboard-top-nav';

type Props = {
  restaurant: { id: string; name: string; slug: string };
  floorStaffRole: FloorBoardRole;
  children: ReactNode;
};

export function DashboardWaiterFloorShell({ restaurant, floorStaffRole, children }: Props) {
  const pathname = usePathname();
  const isDetail = isDashboardWaiterTableDetailPath(pathname);
  const isBoardRoute = isDashboardWaiterBoardListPath(pathname);

  if (isDetail) {
    const tableId = dashboardWaiterTableIdFromPath(pathname);
    if (!tableId) notFound();
    return (
      <WaiterTableDetail
        key={tableId}
        restaurant={restaurant}
        tableId={tableId}
        embeddedInDashboard
        floorStaffRole={floorStaffRole}
      />
    );
  }

  return (
    <>
      {isBoardRoute ? (
        <WaiterDisplay
          restaurant={restaurant}
          embeddedInDashboard
          floorStaffRole={floorStaffRole}
        />
      ) : null}
      {children}
    </>
  );
}
