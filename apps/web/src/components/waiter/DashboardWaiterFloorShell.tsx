'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import type { WaiterBoardData } from '@/lib/staff-board';
import {
  isDashboardWaiterBoardListPath,
  isDashboardWaiterTableDetailPath,
} from '@/lib/dashboard-top-nav';

type Props = {
  restaurant: { id: string; name: string; slug: string };
  board: WaiterBoardData | null;
  children: ReactNode;
};

export function DashboardWaiterFloorShell({ restaurant, board, children }: Props) {
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
          hasAuthoritativeSeed={board != null}
          tables={board?.tables}
          initialTableSummaries={board?.tableSummaries}
          initialCheckoutRequestedTableIds={board?.checkoutRequestedTableIds}
          initialSessionMetaByTableId={board?.sessionMetaByTableId}
          initialCheckoutRequestedAtByTableId={board?.checkoutRequestedAtByTableId}
          initialGroups={board?.groups}
          initialMembers={board?.members}
          restaurantHasActiveBuffets={board?.restaurantHasActiveBuffets ?? false}
          initialOpenTableDefaults={board?.openTableDefaults ?? null}
        />
      ) : null}
      {children}
    </>
  );
}
