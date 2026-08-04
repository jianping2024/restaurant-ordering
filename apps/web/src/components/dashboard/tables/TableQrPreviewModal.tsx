'use client';

import { PreferBrowserHttpLink } from '@/components/pwa/PreferBrowserHttpLink';
import { Modal } from '@/components/ui/Modal';
import { buildTableMenuQrUrl } from '@/lib/table-menu-qr';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

type PreviewTarget = {
  table: RestaurantTableRow;
  stickerSrc: string;
};

type Props = {
  open: boolean;
  target: PreviewTarget | null;
  restaurantSlug: string;
  webOrigin: string;
  labels: {
    title: string;
    table: string;
    openOrder: string;
  };
  onClose: () => void;
};

export function TableQrPreviewModal({
  open,
  target,
  restaurantSlug,
  webOrigin,
  labels: t,
  onClose,
}: Props) {
  if (!target) return null;

  return (
    <Modal open={open} onClose={onClose} title={t.title} size="sm">
      <div className="text-center space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={target.stickerSrc}
          alt={`${t.table} ${target.table.display_name}`}
          className="mx-auto w-full max-w-[400px] rounded-lg border border-brand-border"
        />
        <PreferBrowserHttpLink
          href={buildTableMenuQrUrl(restaurantSlug, target.table.id, webOrigin)}
          className="inline-block text-[13px] text-brand-gold hover:underline"
        >
          {t.openOrder}
        </PreferBrowserHttpLink>
      </div>
    </Modal>
  );
}
