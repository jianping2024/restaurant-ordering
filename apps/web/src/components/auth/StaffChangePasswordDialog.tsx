'use client';

import { Modal } from '@/components/ui/Modal';
import { StaffChangePasswordForm } from '@/components/auth/StaffChangePasswordForm';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Account-menu voluntary change-password — same form as forced page, Modal shell only. */
export function StaffChangePasswordDialog({ open, onClose }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).staffAuth;

  return (
    <Modal open={open} onClose={onClose} title={t.voluntaryChangeTitle} size="sm">
      {open ? <StaffChangePasswordForm intent="voluntary" onSuccess={onClose} /> : null}
    </Modal>
  );
}
