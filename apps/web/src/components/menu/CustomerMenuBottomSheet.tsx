'use client';

import type { ReactNode } from 'react';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';
import {
  customerMenuBottomSheetBodyClass,
  customerMenuBottomSheetFooterClass,
  customerMenuBottomSheetHandleRowClass,
  customerMenuBottomSheetHeaderClass,
  customerMenuBottomSheetPanelClass,
  customerMenuBottomSheetPanelClosedClass,
  customerMenuBottomSheetPanelOpenClass,
} from '@/lib/customer-menu-bottom-sheet-layout';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';

/** Sole customer menu bottom sheet chrome (cart / 已点 / 本轮核单). */
export function CustomerMenuBottomSheet({
  open,
  onClose,
  title,
  headerActions,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional controls between title and close (e.g. cart clear). */
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useBodyScrollLock(open);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      ) : null}

      <div
        className={`${customerMenuBottomSheetPanelClass} ${
          open ? customerMenuBottomSheetPanelOpenClass : customerMenuBottomSheetPanelClosedClass
        }`}
      >
        <div className={customerMenuBottomSheetHandleRowClass}>
          <div className="h-1 w-10 rounded-full bg-brand-border" />
        </div>

        <div className={customerMenuBottomSheetHeaderClass}>
          <h2 className={`min-w-0 flex-1 ${CUSTOMER_MENU_TYPE.drawerTitle}`}>{title}</h2>
          {headerActions}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-brand-text-muted hover:text-brand-text"
          >
            ✕
          </button>
        </div>

        <div className={customerMenuBottomSheetBodyClass}>{open ? children : null}</div>

        {footer ? <div className={customerMenuBottomSheetFooterClass}>{footer}</div> : null}
      </div>
    </>
  );
}
