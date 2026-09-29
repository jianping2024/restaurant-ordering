'use client';

import {
  APPEND_CART_NOTE_MAX_LEN,
  type CartItem,
  type Language,
} from '@/types';
import { Button } from '@/components/ui/Button';
import { CustomerMenuBottomSheet } from '@/components/menu/CustomerMenuBottomSheet';
import {
  menuNotePresetLocalizedName,
  type MenuNotePresetCatalog,
} from '@/lib/menu-note-presets';
import { lineTotal, sumLineTotals } from '@/lib/cart-totals';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { customerTextInputClass } from '@/components/menu/customer-form-input-styles';
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
  onUpdateNote,
  onToggleNotePreset,
  onSubmit,
  submitting,
  submitCooldownRemaining = 0,
}: CartDrawerProps) {
  const t = MENU_PAGE_MESSAGES[lang];
  const cartTotal = sumLineTotals(cart);
  const cooldownActive = submitCooldownRemaining > 0;
  const submitLabel = cooldownActive
    ? formatSubmitCooldownWaitMessage(t.submitCooldownWait, submitCooldownRemaining)
    : t.placeOrder;

  return (
    <CustomerMenuBottomSheet
      open={open}
      onClose={onClose}
      title={t.cartTitle}
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
        {cart.map((item) => {
          const enabledGroupIds = new Set(item.notePresetGroupIds || []);
          const selected = new Set(item.selectedNotePresetIds || []);
          const groupsForItem = notePresetCatalog.groups.filter((group) =>
            enabledGroupIds.has(group.id),
          );

          return (
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
                <CartQtyStepper
                  qty={item.qty}
                  onDecrement={() => {
                    const q = Number(item.qty);
                    onUpdateQty(item.menuItemId, (Number.isFinite(q) ? q : 0) - 1);
                  }}
                  onIncrement={() => {
                    const q = Number(item.qty);
                    onUpdateQty(item.menuItemId, (Number.isFinite(q) ? q : 0) + 1);
                  }}
                />
              </div>

              <div className="mt-3">
                <input
                  type="text"
                  placeholder={t.cartNotePlaceholder}
                  value={item.note || ''}
                  maxLength={APPEND_CART_NOTE_MAX_LEN}
                  onChange={(e) => onUpdateNote(item.menuItemId, e.target.value)}
                  className={customerTextInputClass}
                />
                <div className="mt-2 space-y-2">
                  {groupsForItem.map((group) => (
                    <div key={`${item.menuItemId}-${group.id}`}>
                      <p className="mb-1 text-[13px] text-brand-text-muted">
                        {menuNotePresetLocalizedName(group, lang)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.presets.map((preset) => {
                          const note = menuNotePresetLocalizedName(preset, lang);
                          const isOn = selected.has(preset.id);
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => onToggleNotePreset(item.menuItemId, preset.id)}
                              className={`rounded-full px-2 py-0.5 text-[13px] transition-colors ${
                                isOn
                                  ? 'bg-brand-gold/20 text-brand-gold'
                                  : 'bg-brand-border text-brand-text-muted hover:bg-brand-gold/10 hover:text-brand-gold'
                              }`}
                            >
                              {note}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {groupsForItem.length === 0 && (
                    <p className="text-[13px] text-brand-text-muted">{t.noQuickNotes}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CustomerMenuBottomSheet>
  );
}
