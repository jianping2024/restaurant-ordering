'use client';

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

/** Sign-out button with optional confirmation — shared by staff boards and auth flows. */
export function StaffSignOutControl({
  exitLabel,
  onSignOut,
  confirmSignOut = true,
  className = '',
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
      <button
        type="button"
        onClick={handleClick}
        className={`text-[12px] px-2 py-1 rounded-md border border-brand-border text-brand-text-muted hover:text-brand-text transition-colors ${className}`}
      >
        {exitLabel}
      </button>
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
