'use client';

import type { ReactNode } from 'react';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';
import { CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS } from '@/lib/customer-menu-bottom-bar-layout';
import { CUSTOMER_MENU_SHELL_WIDTH_CLASS } from '@/lib/customer-menu-chrome-layout';
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
        className={`
        fixed bottom-0 left-1/2 z-40 ${CUSTOMER_MENU_SHELL_WIDTH_CLASS} -translate-x-1/2
        rounded-t-3xl border-t border-brand-border bg-brand-card
        ${CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS}
        transition-transform duration-300 ease-out
        ${open ? 'translate-y-0' : 'translate-y-full'}
      `}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-brand-border" />
        </div>

        <div className="flex items-center gap-3 border-b border-brand-border px-5 py-3">
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

        <div className="modal-scroll max-h-[60vh] overflow-y-auto px-5 py-4">{open ? children : null}</div>

        {footer ? <div className="border-t border-brand-border px-5 py-4">{footer}</div> : null}
      </div>
    </>
  );
}
