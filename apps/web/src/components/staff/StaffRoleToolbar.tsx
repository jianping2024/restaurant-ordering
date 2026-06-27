'use client';

import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import {
  SignOutConfirmModal,
  useSignOutConfirmState,
} from '@/lib/auth/sign-out-confirm';

type Props = {
  exitLabel: string;
  onSignOut: () => void;
  /** When false, runs immediately (e.g. owner returning to dashboard). Default true. */
  confirmSignOut?: boolean;
  className?: string;
};

/** Top-right language + sign-out row shared by kitchen / waiter staff boards. */
export function StaffRoleToolbar({
  exitLabel,
  onSignOut,
  confirmSignOut = true,
  className = 'mb-3',
}: Props) {
  const { requestSignOut, modalOpen, modalConfirming, closeModal, confirmSignOut: runSignOut } =
    useSignOutConfirmState(onSignOut);

  const handleClick = () => {
    if (confirmSignOut) {
      requestSignOut();
      return;
    }
    onSignOut();
  };

  return (
    <>
      <div className={`flex justify-end items-center gap-2 ${className}`}>
        <LanguageSwitcher compact />
        <button
          type="button"
          onClick={handleClick}
          className="text-[12px] px-2 py-1 rounded-md border border-brand-border text-brand-text-muted hover:text-brand-text transition-colors"
        >
          {exitLabel}
        </button>
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
