'use client';

import { useRef, useState } from 'react';
import { useSignOutConfirmState, SignOutConfirmModal } from '@/lib/auth/sign-out-confirm';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { DASHBOARD_NAV_ITEMS } from '@/lib/dashboard-feature-registry';
import { dashboardTopNavButtonClass } from '@/lib/dashboard-top-nav';
import { DashboardTopBarDropdownPanel } from '@/components/dashboard/DashboardTopBarDropdownPanel';
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
        <DashboardTopBarDropdownPanel
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={rootRef}
          mobilePortal={compact}
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
        </DashboardTopBarDropdownPanel>
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
