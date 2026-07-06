'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import {
  isDashboardWaiterBoardListPath,
  isDashboardWaiterTableDetailPath,
} from '@/lib/dashboard-top-nav';

type Props = {
  restaurant: { id: string; name: string; slug: string };
  children: ReactNode;
};

export function DashboardWaiterFloorShell({ restaurant, children }: Props) {
  const pathname = usePathname();
  const isDetail = isDashboardWaiterTableDetailPath(pathname);
  const isBoardRoute = isDashboardWaiterBoardListPath(pathname);

  if (isDetail) {
    return <>{children}</>;
  }

  return (
    <>
      {isBoardRoute ? <WaiterDisplay restaurant={restaurant} embeddedInDashboard /> : null}
      {children}
    </>
  );
}
