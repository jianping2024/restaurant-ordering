'use client';

import { Modal } from '@/components/ui/Modal';
import { buildTableMenuQrUrl } from '@/lib/table-menu-qr';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

type PreviewTarget = {
  table: RestaurantTableRow;
  groupName?: string;
  qrSrc: string;
};

type Props = {
  open: boolean;
  target: PreviewTarget | null;
  restaurantSlug: string;
  labels: {
    title: string;
    table: string;
    openOrder: string;
    close: string;
  };
  onClose: () => void;
};

export function TableQrPreviewModal({ open, target, restaurantSlug, labels: t, onClose }: Props) {
  if (!target) return null;

  return (
    <Modal open={open} onClose={onClose} title={t.title} size="sm">
      <div className="text-center space-y-3">
        <p className="font-heading text-2xl text-brand-gold">{target.table.display_name}</p>
        {target.groupName ? (
          <p className="text-sm text-brand-text-muted">{target.groupName}</p>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={target.qrSrc}
          alt={`${t.table} ${target.table.display_name}`}
          className="mx-auto rounded-lg w-56 h-56"
        />
        <a
          href={buildTableMenuQrUrl(restaurantSlug, target.table.id)}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-[13px] text-brand-gold hover:underline"
        >
          {t.openOrder}
        </a>
      </div>
    </Modal>
  );
}
