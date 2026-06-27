'use client';

import { useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

export type SignOutConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirming?: boolean;
};

export function SignOutConfirmModal({
  open,
  onClose,
  onConfirm,
  confirming = false,
}: SignOutConfirmModalProps) {
  const { lang } = useLanguage();
  const copy = getMessages(lang).signOutConfirm;

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title={copy.title}
      message={copy.message}
      confirmLabel={copy.confirm}
      cancelLabel={copy.cancel}
      variant="danger"
      confirming={confirming}
      onConfirm={onConfirm}
    />
  );
}

export function useSignOutConfirmState(onConfirm: () => void | Promise<void>) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const closeModal = () => {
    if (!confirming) setOpen(false);
  };

  const confirmSignOut = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setConfirming(false);
    }
  };

  return {
    requestSignOut: () => setOpen(true),
    modalOpen: open,
    modalConfirming: confirming,
    closeModal,
    confirmSignOut,
  };
}
