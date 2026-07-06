'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  dashboardTopBarDesktopDropdownPanelClass,
  dashboardTopBarMobileDropdownPanelClass,
  dashboardTopBarMobileDropdownPanelStyle,
} from '@/lib/dashboard-top-nav';

const MOBILE_TOP_NAV_MQ = '(max-width: 639px)';

type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Portal + viewport-safe positioning on mobile (dashboard compact top bar). */
  mobilePortal?: boolean;
};

export function DashboardTopBarDropdownPanel({
  open,
  onClose,
  anchorRef,
  children,
  mobilePortal = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [usePortal, setUsePortal] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mobilePortal) {
      setUsePortal(false);
      return;
    }
    const mq = window.matchMedia(MOBILE_TOP_NAV_MQ);
    const update = () => setUsePortal(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [mobilePortal]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      role="menu"
      className={
        usePortal
          ? dashboardTopBarMobileDropdownPanelClass()
          : dashboardTopBarDesktopDropdownPanelClass()
      }
      style={usePortal ? dashboardTopBarMobileDropdownPanelStyle() : undefined}
    >
      {children}
    </div>
  );

  if (usePortal) {
    return createPortal(panel, document.body);
  }

  return panel;
}
