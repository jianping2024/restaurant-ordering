'use client';

import type { ReactNode } from 'react';
import {
  StaffAuthenticatedShell,
  type StaffShellContext,
} from '@/components/staff/StaffAuthenticatedShell';

type Props = {
  restaurant: { id: string; name: string; slug: string };
  isDemo?: boolean;
  children: (ctx: StaffShellContext) => ReactNode;
};

export function WaiterAuthenticatedShell({ restaurant, isDemo, children }: Props) {
  return (
    <StaffAuthenticatedShell restaurant={restaurant} expectedRole="waiter" isDemo={isDemo}>
      {children}
    </StaffAuthenticatedShell>
  );
}

export type { StaffShellContext };
