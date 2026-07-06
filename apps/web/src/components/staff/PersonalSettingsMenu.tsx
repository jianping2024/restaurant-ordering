'use client';

import { useEffect, useRef, useState } from 'react';
import { useSignOutConfirmState, SignOutConfirmModal } from '@/lib/auth/sign-out-confirm';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { DASHBOARD_NAV_ITEMS } from '@/lib/dashboard-feature-registry';
import { dashboardTopNavButtonClass, dashboardTopNavPanelClass } from '@/lib/dashboard-top-nav';
import { PersonalSettingsPanel } from '@/components/staff/PersonalSettingsPanel';

type Props = {
  logoutLabel: string;
  onSignOut: () => void;
  confirmSignOut?: boolean;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function PersonalSettingsMenu({
  logoutLabel,
  onSignOut,
  confirmSignOut = true,
  compact = false,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const rootRef = useRef<HTMLDivElement>(null);

  const { requestSignOut, modalOpen, modalConfirming, closeModal, confirmSignOut: runSignOut } =
    useSignOutConfirmState(onSignOut);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  const handleLogout = () => {
    setOpen(false);
    if (confirmSignOut) {
      requestSignOut();
      return;
    }
    onSignOut();
  };

  return (
    <>
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t.settingsMenu}
          onClick={() => setOpen(!open)}
          className={
            compact
              ? dashboardTopNavButtonClass(open, true)
              : dashboardTopNavButtonClass(open, false)
          }
        >
          <span aria-hidden>{DASHBOARD_NAV_ITEMS.settings.icon}</span>
          {compact ? null : <span>{t.settingsMenu}</span>}
        </button>
        {open ? (
          <div
            role="menu"
            className={
              compact
                ? dashboardTopNavPanelClass()
                : 'absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-brand-border bg-brand-card py-2 shadow-lg shadow-black/10'
            }
          >
            <PersonalSettingsPanel />
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-sm text-status-danger hover:bg-[rgb(var(--color-status-danger-border)/0.08)] transition-colors"
            >
              <span aria-hidden>🚪</span>
              <span>{logoutLabel}</span>
            </button>
          </div>
        ) : null}
      </div>
      {confirmSignOut ? (
        <SignOutConfirmModal
          open={modalOpen}
          onClose={closeModal}
          onConfirm={runSignOut}
          confirming={modalConfirming}
        />
      ) : null}
    </>
  );
}
