'use client';

import type { ReactNode } from 'react';
import { notFound, usePathname } from 'next/navigation';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import type { FloorBoardCapabilities } from '@/lib/floor-board-capabilities';
import type { Capabilities } from '@/lib/permissions/can';
import type { FloorBoardRestaurant } from '@/lib/floor-board-restaurant';
import {
  dashboardWaiterTableIdFromPath,
  isDashboardWaiterBoardListPath,
  isDashboardWaiterTableDetailPath,
} from '@/lib/dashboard-top-nav';

type Props = {
  restaurant: FloorBoardRestaurant;
  floorCapabilities: FloorBoardCapabilities;
  capabilities: Capabilities;
  children: ReactNode;
};

export function DashboardWaiterFloorShell({
  restaurant,
  floorCapabilities,
  capabilities,
  children,
}: Props) {
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
        floorCapabilities={floorCapabilities}
        capabilities={capabilities}
      />
    );
  }

  return (
    <>
      {isBoardRoute ? (
        <WaiterDisplay
          restaurant={restaurant}
          embeddedInDashboard
          floorCapabilities={floorCapabilities}
          capabilities={capabilities}
        />
      ) : null}
      {children}
    </>
  );
}
