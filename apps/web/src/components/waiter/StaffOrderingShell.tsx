'use client';

import type { ReactNode } from 'react';
import { RightPushPanel } from '@/components/ui/RightPushPanel';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
};

/** Continue-order overlay — chrome via sole {@link RightPushPanel}. */
export function StaffOrderingShell({
  open,
  title,
  onClose,
  closeDisabled = false,
  children,
}: Props) {
  return (
    <RightPushPanel
      open={open}
      title={title}
      onClose={onClose}
      closeDisabled={closeDisabled}
      width="ordering"
      titleId="staff-ordering-shell-title"
      titleClassName={CUSTOMER_MENU_TYPE.drawerTitle}
    >
      {children}
    </RightPushPanel>
  );
}
