'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { WaiterBoardData } from '@/lib/staff-board';

export {
  useWaiterBoard,
  useWaiterBoardOptional,
} from '@/components/dashboard/waiter-board-context';
export type { WaiterBoardContextValue } from '@/components/dashboard/waiter-board-context';

const WaiterBoardProviderInner = dynamic(
  () =>
    import('@/components/dashboard/WaiterBoardProviderInner').then(
      (m) => m.WaiterBoardProviderInner,
    ),
  { ssr: false },
);

type Props = {
  restaurant: { id: string; slug: string };
  enabled: boolean;
  /** Optional SSR/demo seed — Dashboard chrome passes none; floor hydrates on list surface. */
  initialBoard?: WaiterBoardData | null;
  children: ReactNode;
};

export function WaiterBoardProvider({
  restaurant,
  enabled,
  initialBoard = null,
  children,
}: Props) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <WaiterBoardProviderInner restaurant={restaurant} initialBoard={initialBoard}>
      {children}
    </WaiterBoardProviderInner>
  );
}
