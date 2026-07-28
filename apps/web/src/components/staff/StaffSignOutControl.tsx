'use client';

import {
  SignOutConfirmModalGate,
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
  const signOut = useSignOutConfirmState(onSignOut);

  return (
    <>
      <button
        type="button"
        onClick={() => signOut.triggerSignOut(confirmSignOut)}
        className={`text-[12px] px-2 py-1 rounded-md border border-brand-border text-brand-text-muted hover:text-brand-text transition-colors ${className}`}
      >
        {exitLabel}
      </button>
      <SignOutConfirmModalGate
        enabled={confirmSignOut}
        open={signOut.modalOpen}
        onClose={signOut.closeModal}
        onConfirm={signOut.confirmSignOut}
        confirming={signOut.modalConfirming}
      />
    </>
  );
}
