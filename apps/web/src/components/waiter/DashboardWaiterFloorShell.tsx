'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import type { FloorBoardRole } from '@/lib/floor-board-capabilities';
import {
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
    return <>{children}</>;
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
