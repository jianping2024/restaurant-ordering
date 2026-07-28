'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { Language } from '@/types';
import {
  guestOrderingNoticeHasUnreadUpdate,
  markGuestOrderingNoticeSeen,
  type GuestOrderingNoticeLocalized,
} from '@/lib/guest-ordering-notice';
import { customerMenuNoticeTabShellClass } from '@/lib/customer-menu-chrome-layout';
import { getMessages } from '@/lib/i18n/messages';

type Props = {
  restaurantId: string;
  notice: GuestOrderingNoticeLocalized;
  lang: Language;
  hidden?: boolean;
};

export function CustomerGuestOrderingNotice({
  restaurantId,
  notice,
  lang,
  hidden = false,
}: Props) {
  const t = getMessages(lang).guestNoticeCustomer;
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    setUnread(guestOrderingNoticeHasUnreadUpdate(restaurantId, notice.updatedAt));
  }, [restaurantId, notice.updatedAt]);

  if (hidden) return null;

  const handleOpen = () => {
    setOpen(true);
    markGuestOrderingNoticeSeen(restaurantId, notice.updatedAt);
    setUnread(false);
  };

  return (
    <>
      <div className={customerMenuNoticeTabShellClass}>
        <button
          type="button"
          onClick={handleOpen}
          aria-label={t.openLabel}
          className="pointer-events-auto absolute right-0 flex max-w-[2.75rem] flex-col items-center gap-1 rounded-l-xl border border-r-0 border-brand-gold/45 bg-brand-card/95 px-1.5 py-3 text-center shadow-lg backdrop-blur-sm transition-colors hover:bg-brand-gold/10 active:bg-brand-gold/15"
        >
          <span className="text-base leading-none" aria-hidden>
            📢
          </span>
          <span className="text-[10px] font-semibold leading-tight text-brand-gold [writing-mode:vertical-rl]">
            {t.tabLabel}
          </span>
          {unread ? (
            <span
              className="absolute -left-1 top-2 h-2.5 w-2.5 rounded-full bg-brand-gold ring-2 ring-brand-bg"
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
