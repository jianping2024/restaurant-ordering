'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import { MenuItemListThumb } from '@/components/dashboard/MenuItemListThumb';
import { formatMenuCatalogItemLabel } from '@/lib/menu-item-display';
import {
  DEFAULT_DISH_VIDEO_EFFECT,
  DISH_VIDEO_EFFECT_MESSAGE_KEYS,
  DISH_VIDEO_EFFECTS,
  type DishVideoEffect,
} from '@/lib/menu-dish-video';
import {
  mesaSelectionChipShellClass,
  mesaSelectionChipSoftClass,
} from '@/lib/mesa-selection-chip';
import type { getMessages } from '@/lib/i18n/messages';
import type { Language, MenuItem } from '@/types';

type MenuManagerMessages = ReturnType<typeof getMessages>['menuManager'];

/**
 * Sole batch dish-video confirm panel: current-page eligible candidates + one shared effect.
 * Open only from the menu toolbar. Confirm row lives in Modal `footer` (not in the scroll body).
 */
export function DishVideoBatchModal({
  open,
  onClose,
  candidates,
  lang,
  t,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** Snapshot at open: has photo, no video (caller filters). */
  candidates: MenuItem[];
  lang: Language;
  t: MenuManagerMessages;
  onConfirm: (ids: string[], effect: DishVideoEffect) => void;
}) {
  const [effect, setEffect] = useState<DishVideoEffect>(DEFAULT_DISH_VIDEO_EFFECT);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const candidateIds = useMemo(() => candidates.map((c) => c.id), [candidates]);

  useEffect(() => {
    if (!open) return;
    setEffect(DEFAULT_DISH_VIDEO_EFFECT);
    setSelectedIds(candidateIds);
  }, [open, candidateIds]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;

  const toggleId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.dishVideoBatchModalTitle}
      size="md"
      footer={
        <ModalConfirmActions
          cancelLabel={t.cancel}
          confirmLabel={
            selectedCount === 0
              ? t.dishVideoBatchConfirm
              : t.dishVideoBatchConfirmN.replace('{n}', String(selectedCount))
          }
          onCancel={onClose}
          onConfirm={() => onConfirm(selectedIds, effect)}
          confirmDisabled={selectedCount === 0}
          confirmVariant="gold"
        />
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-brand-text-muted">
          {t.dishVideoBatchModalHint.replace('{n}', String(candidates.length))}
        </p>

        <div>
          <p className="mb-2 text-[13px] text-brand-text-muted">{t.dishVideoTitle}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.dishVideoTitle}>
            {DISH_VIDEO_EFFECTS.map((key) => {
              const active = effect === key;
              const keys = DISH_VIDEO_EFFECT_MESSAGE_KEYS[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setEffect(key)}
                  className={`text-[13px] px-2.5 py-1 ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(active)}`}
                >
                  {t[keys.label]}
                  <span className="ml-1 text-[11px] text-brand-text-muted">{t[keys.hint]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-brand-text-muted">
          <span>
            {t.dishVideoBatchSelected
              .replace('{n}', String(selectedCount))
              .replace('{total}', String(candidates.length))}
          </span>
          <button
            type="button"
            className="underline underline-offset-2 hover:text-brand-text"
            onClick={() => setSelectedIds(candidateIds)}
          >
            {t.dishVideoBatchSelectAll}
          </button>
          <button
            type="button"
            className="underline underline-offset-2 hover:text-brand-text"
            onClick={() => setSelectedIds([])}
          >
            {t.dishVideoBatchSelectNone}
          </button>
        </div>

        {candidates.length === 0 ? (
          <p className="text-sm text-brand-text-muted py-6 text-center">{t.dishVideoBatchEmpty}</p>
        ) : (
          <ul className="divide-y divide-brand-border/60 -mx-1 px-1">
            {candidates.map((item) => {
              const checked = selectedSet.has(item.id);
              const label = formatMenuCatalogItemLabel(item, lang);
              return (
                <li key={item.id}>
                  <label className="flex items-center gap-2.5 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleId(item.id, e.target.checked)}
                      className="rounded border-brand-border text-brand-gold focus:ring-brand-gold/40 shrink-0"
                      aria-label={label}
                    />
                    <MenuItemListThumb item={item} />
                    <span className="min-w-0 flex-1 text-sm text-brand-text truncate">{label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
