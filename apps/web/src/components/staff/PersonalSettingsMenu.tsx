'use client';

import { useEffect, useRef, useState } from 'react';
import {
  SignOutConfirmModalGate,
  useSignOutConfirmState,
} from '@/lib/auth/sign-out-confirm';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { topNavAccountTriggerClass } from '@/lib/dashboard-top-nav';
import { DashboardTopBarDropdownPanel } from '@/components/dashboard/DashboardTopBarDropdownPanel';
import {
  PersonalSettingsPanel,
  type PersonalSettingsNotifyMode,
} from '@/components/staff/PersonalSettingsPanel';
import { StaffChangePasswordDialog } from '@/components/auth/StaffChangePasswordDialog';
import {
  resolveRestaurantPrintNotifyMode,
  type PrintAgentDeviceHeartbeatRow,
} from '@/lib/print-agent-heartbeat';

type Props = {
  roleLabel: string;
  logoutLabel: string;
  onSignOut: () => void;
  confirmSignOut?: boolean;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Demo / guest shells without a real session hide voluntary change-password. */
  allowChangePassword?: boolean;
};

export function PersonalSettingsMenu({
  roleLabel,
  logoutLabel,
  onSignOut,
  confirmSignOut = true,
  compact = false,
  open: controlledOpen,
  onOpenChange,
  allowChangePassword = true,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const rootRef = useRef<HTMLDivElement>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [notifyMode, setNotifyMode] = useState<PersonalSettingsNotifyMode>({
    status: 'loading',
  });

  const signOut = useSignOutConfirmState(onSignOut);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/print-agent/devices', { credentials: 'include' });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setNotifyMode({ status: 'denied' });
          return;
        }
        if (!res.ok) {
          setNotifyMode({ status: 'ready', mode: null });
          return;
        }
        const json = (await res.json()) as { devices?: PrintAgentDeviceHeartbeatRow[] };
        if (!cancelled) {
          setNotifyMode({
            status: 'ready',
            mode: resolveRestaurantPrintNotifyMode(json.devices || []),
          });
        }
      } catch {
        if (!cancelled) setNotifyMode({ status: 'ready', mode: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    setOpen(false);
    signOut.triggerSignOut(confirmSignOut);
  };

  const handleOpenChangePassword = () => {
    setOpen(false);
    setChangePasswordOpen(true);
  };

  const accountAriaLabel = `${roleLabel} — ${t.accountMenu}`;

  return (
    <>
      <div ref={rootRef} className="relative shrink-0 self-stretch">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={accountAriaLabel}
          onClick={() => setOpen(!open)}
          className={topNavAccountTriggerClass(open)}
        >
          <span className="truncate">{roleLabel}</span>
          <span className="shrink-0 text-[10px] opacity-60" aria-hidden>
            ▾
          </span>
        </button>
        <DashboardTopBarDropdownPanel
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={rootRef}
          mobilePortal={compact}
          align="end"
        >
          <PersonalSettingsPanel notifyMode={notifyMode} />
          {allowChangePassword ? (
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenChangePassword}
              className="flex min-h-11 w-full items-center gap-2 border-b border-brand-border/70 px-3 py-2.5 text-sm text-brand-text hover:bg-brand-surface/80 transition-colors"
            >
              <span aria-hidden>🔑</span>
              <span>{t.changePassword}</span>
            </button>
          ) : null}
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
      <SignOutConfirmModalGate
        enabled={confirmSignOut}
        open={signOut.modalOpen}
        onClose={signOut.closeModal}
        onConfirm={signOut.confirmSignOut}
        confirming={signOut.modalConfirming}
      />
      {allowChangePassword ? (
        <StaffChangePasswordDialog
          open={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
        />
      ) : null}
    </>
  );
}
