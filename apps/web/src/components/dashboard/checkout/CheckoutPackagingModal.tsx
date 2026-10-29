'use client';

import { useEffect, useMemo, useState } from 'react';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import { RightPushPanel } from '@/components/ui/RightPushPanel';
import { PACKAGING_QTY_MAX, type PackagingLineInput } from '@/lib/checkout-packaging';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import type { UILanguage } from '@/lib/i18n';

export type PackagingCatalogItem = {
  id: string;
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  price: number;
  emoji?: string | null;
};

type Labels = {
  title: string;
  empty: string;
  qty: string;
  total: string;
  confirm: string;
  cancel: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  lang: UILanguage;
  items: PackagingCatalogItem[];
  labels: Labels;
  onClose: () => void;
  onConfirm: (lines: PackagingLineInput[]) => void | Promise<void>;
};

/** Sole checkout packaging supply picker: list packaging menu items + qty steppers. */
export function CheckoutPackagingModal({
  open,
  busy,
  lang,
  items,
  labels,
  onClose,
  onConfirm,
}: Props) {
  const [qtyById, setQtyById] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    setQtyById({});
  }, [open]);

  const lines = useMemo(() => {
    const out: PackagingLineInput[] = [];
    for (const item of items) {
      const qty = qtyById[item.id] ?? 0;
      if (qty >= 1) out.push({ menuItemId: item.id, qty });
    }
    return out;
  }, [items, qtyById]);

  const total = useMemo(() => {
    let sum = 0;
    for (const line of lines) {
      const item = items.find((row) => row.id === line.menuItemId);
      if (!item) continue;
      sum += item.price * line.qty;
    }
    return sum;
  }, [items, lines]);

  const setQty = (id: string, qty: number) => {
    const next = Math.min(PACKAGING_QTY_MAX, Math.max(0, Math.floor(qty) || 0));
    setQtyById((prev) => {
      if (next <= 0) {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  return (
    <RightPushPanel
      open={open}
      title={labels.title}
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      closeDisabled={busy}
      width="form"
      titleId="checkout-packaging-panel-title"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-brand-text-muted px-1 py-2">{labels.empty}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const qty = qtyById[item.id] ?? 0;
                const name = resolveMenuItemLocalizedName(item, lang);
                return (
                  <li
                    key={item.id}
                    className="rounded-xl border border-brand-border bg-brand-card px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-brand-text truncate">
                          {item.emoji ? `${item.emoji} ` : ''}
                          {name}
                        </p>
                        <p className="mt-0.5 text-sm tabular-nums text-brand-gold">
                          €{item.price.toFixed(2)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <CartQtyStepper
                          qty={qty}
                          density="compact"
                          max={PACKAGING_QTY_MAX}
                          disabled={busy}
                          qtyInputAriaLabel={labels.qty}
                          onDecrement={() => setQty(item.id, qty - 1)}
                          onIncrement={() => setQty(item.id, qty + 1)}
                          onQtyChange={(next) => setQty(item.id, next)}
                          incrementDisabled={qty >= PACKAGING_QTY_MAX}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-brand-border px-4 py-3">
          {lines.length > 0 ? (
            <p className="text-sm text-brand-text-muted tabular-nums">
              {labels.total
                .replace('{n}', String(lines.reduce((n, line) => n + line.qty, 0)))
                .replace('{amount}', total.toFixed(2))}
            </p>
          ) : null}
          <ModalConfirmActions
            cancelLabel={labels.cancel}
            confirmLabel={labels.confirm}
            busy={busy}
            confirmDisabled={lines.length === 0}
            onCancel={() => {
              if (busy) return;
              onClose();
            }}
            onConfirm={() => {
              if (busy || lines.length === 0) return;
              void onConfirm(lines);
            }}
          />
        </div>
      </div>
    </RightPushPanel>
  );
}
