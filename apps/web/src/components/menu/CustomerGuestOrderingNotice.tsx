'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { Language } from '@/types';
import {
  guestOrderingNoticeHasUnreadUpdate,
  markGuestOrderingNoticeSeen,
  type GuestOrderingNoticeLocalized,
} from '@/lib/guest-ordering-notice';
import { appearanceChromeButtonClass, appearanceChromeGroupClass } from '@/lib/appearance-chrome';
import { getMessages } from '@/lib/i18n/messages';
import { CustomerNoticeIcon } from '@/components/menu/customer-ordering-icons';

type Props = {
  restaurantId: string;
  notice: GuestOrderingNoticeLocalized;
  lang: Language;
};

/**
 * Sole guest restaurant-notice entry: one megaphone capsule in the ordering header
 * (beside language + theme) — never an edge float over the dish list.
 */
export function CustomerGuestOrderingNotice({
  restaurantId,
  notice,
  lang,
}: Props) {
  const t = getMessages(lang).guestNoticeCustomer;
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    setUnread(guestOrderingNoticeHasUnreadUpdate(restaurantId, notice.updatedAt));
  }, [restaurantId, notice.updatedAt]);

  const handleOpen = () => {
    setOpen(true);
    markGuestOrderingNoticeSeen(restaurantId, notice.updatedAt);
    setUnread(false);
  };

  return (
    <>
      <div className={appearanceChromeGroupClass}>
        <button
          type="button"
          onClick={handleOpen}
          aria-label={t.openLabel}
          className={`relative ${appearanceChromeButtonClass('segment')} text-brand-gold hover:text-brand-gold-light`}
        >
          <CustomerNoticeIcon className="h-5 w-5" />
          {unread ? (
            <span
              className="absolute right-1.5 top-2.5 h-2 w-2 rounded-full bg-brand-gold ring-2 ring-brand-card"
              aria-hidden
            />
          ) : null}
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={notice.title} size="md">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-text">
          {notice.body}
        </p>
      </Modal>
    </>
  );
}
