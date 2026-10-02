'use client';

import { type CartItem, type Language } from '@/types';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { CustomerMenuBottomSheet } from '@/components/menu/CustomerMenuBottomSheet';
import { CustomerCartItemNoteFields } from '@/components/menu/CustomerCartItemNoteFields';
import type { MenuNotePresetCatalog } from '@/lib/menu-note-presets';
import { lineTotal, sumLineTotals } from '@/lib/cart-totals';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { RowRemoveIconButton } from '@/components/menu/RowRemoveIconButton';
import { formatSubmitCooldownWaitMessage } from '@/lib/order-submit-cooldown-client';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { formatLocalizedMenuItemLabel } from '@/lib/menu-item-display';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';

interface CartDrawerProps {
  open: boolean;
  cart: CartItem[];
  menuItemCodeById: Record<string, string>;
  notePresetCatalog: MenuNotePresetCatalog;
  lang: Language;
  onClose: () => void;
  onUpdateQty: (id: string, qty: number) => void;
  /** Empty cart + close drawer (same path as post-submit clear). */
  onClearCart: () => void;
  onUpdateNote: (id: string, note: string) => void;
  onToggleNotePreset: (menuItemId: string, presetId: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitCooldownRemaining?: number;
}

export function CartDrawer({
  open,
  cart,
  menuItemCodeById,
  notePresetCatalog,
  lang,
  onClose,
  onUpdateQty,
  onClearCart,
  onUpdateNote,
  onToggleNotePreset,
  onSubmit,
  submitting,
  submitCooldownRemaining = 0,
}: CartDrawerProps) {
  const t = MENU_PAGE_MESSAGES[lang];
  const cartTotal = sumLineTotals(cart);
  const cooldownActive = submitCooldownRemaining > 0;
  const cartLocked = submitting;
  const submitLabel = cooldownActive
    ? formatSubmitCooldownWaitMessage(t.submitCooldownWait, submitCooldownRemaining)
    : t.placeOrder;
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) setClearConfirmOpen(false);
  }, [open]);

  return (
    <>
      <CustomerMenuBottomSheet
        open={open}
        onClose={onClose}
        title={t.cartTitle}
        headerActions={
          cart.length > 0 ? (
            <button
              type="button"
              disabled={cartLocked}
              onClick={() => setClearConfirmOpen(true)}
              className="text-sm font-medium text-brand-gold hover:text-brand-gold-dark disabled:opacity-40 disabled:pointer-events-none"
            >
              {t.cartClear}
            </button>
          ) : null
        }
        footer={
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-brand-text">{t.cartTotalLabel}</span>
              <span className={CUSTOMER_MENU_TYPE.cartDrawerTotal}>€{cartTotal.toFixed(2)}</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={onSubmit}
              loading={submitting}
              disabled={cart.length === 0 || cooldownActive}
            >
              {submitLabel}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {cart.map((item) => (
            <div key={item.menuItemId} className="rounded-xl border border-brand-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <div className="min-w-0">
                    <p className={`truncate text-brand-text ${CUSTOMER_MENU_TYPE.cartLineName}`}>
                      {formatLocalizedMenuItemLabel(item, lang, menuItemCodeById[item.menuItemId])}
                    </p>
                    <p className={CUSTOMER_MENU_TYPE.moneyAmount}>€{lineTotal(item).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <CartQtyStepper
                    qty={item.qty}
                    density="compact"
                    disabled={cartLocked}
                    onDecrement={() => {
                      const q = Number(item.qty);
                      onUpdateQty(item.menuItemId, (Number.isFinite(q) ? q : 0) - 1);
                    }}
                    onIncrement={() => {
                      const q = Number(item.qty);
                      onUpdateQty(item.menuItemId, (Number.isFinite(q) ? q : 0) + 1);
                    }}
                  />
                  <RowRemoveIconButton
                    removable
                    disabled={cartLocked}
                    ariaLabel={t.cartRemoveLineAria}
                    onRemove={() => onUpdateQty(item.menuItemId, 0)}
                  />
                </div>
              </div>

              <div className="mt-3">
                <CustomerCartItemNoteFields
                  lang={lang}
                  notePresetCatalog={notePresetCatalog}
                  notePresetGroupIds={item.notePresetGroupIds || []}
                  selectedNotePresetIds={item.selectedNotePresetIds || []}
                  note={item.note || ''}
                  onUpdateNote={(note) => onUpdateNote(item.menuItemId, note)}
                  onToggleNotePreset={(presetId) => onToggleNotePreset(item.menuItemId, presetId)}
                />
              </div>
            </div>
          ))}
        </div>
      </CustomerMenuBottomSheet>

      <ConfirmModal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title={t.cartClearConfirmTitle}
        message={t.cartClearConfirmMessage}
        confirmLabel={t.cartClearConfirm}
        cancelLabel={t.cartClearCancel}
        variant="danger"
        confirming={cartLocked}
        onConfirm={() => {
          setClearConfirmOpen(false);
          onClearCart();
        }}
      />
    </>
  );
}
