'use client';

import { APPEND_CART_NOTE_MAX_LEN } from '@/types';
import type { Language } from '@/types';
import {
  menuNotePresetLocalizedName,
  type MenuNotePresetCatalog,
} from '@/lib/menu-note-presets';
import { mesaSelectionChipShellClass, mesaSelectionChipSoftClass } from '@/lib/mesa-selection-chip';
import { customerTextInputClass } from '@/components/menu/customer-form-input-styles';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

type Props = {
  lang: Language;
  notePresetCatalog: MenuNotePresetCatalog;
  notePresetGroupIds: readonly string[];
  selectedNotePresetIds: readonly string[];
  note: string;
  onUpdateNote: (note: string) => void;
  onToggleNotePreset: (presetId: string) => void;
  /** When true, inputs are non-interactive (sold out). */
  disabled?: boolean;
};

/**
 * Sole guest cart/detail note UI: free-text + soft-chip presets for dish-linked groups.
 * Cart drawer and dish detail both mount this — do not hand-roll a second note block.
 */
export function CustomerCartItemNoteFields({
  lang,
  notePresetCatalog,
  notePresetGroupIds,
  selectedNotePresetIds,
  note,
  onUpdateNote,
  onToggleNotePreset,
  disabled = false,
}: Props) {
  const t = MENU_PAGE_MESSAGES[lang];
  const enabledGroupIds = new Set(notePresetGroupIds);
  const selected = new Set(selectedNotePresetIds);
  const groupsForItem = notePresetCatalog.groups.filter((group) => enabledGroupIds.has(group.id));

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : undefined}>
      <input
        type="text"
        placeholder={t.cartNotePlaceholder}
        value={note}
        maxLength={APPEND_CART_NOTE_MAX_LEN}
        disabled={disabled}
        onChange={(e) => onUpdateNote(e.target.value)}
        className={customerTextInputClass}
      />
      <div className="mt-2 space-y-2">
        {groupsForItem.map((group) => (
          <div key={group.id}>
            <p className="mb-1 text-[13px] text-brand-text-muted">
              {menuNotePresetLocalizedName(group, lang)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.presets.map((preset) => {
                const label = menuNotePresetLocalizedName(preset, lang);
                const isOn = selected.has(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggleNotePreset(preset.id)}
                    className={`${mesaSelectionChipShellClass} px-2 py-0.5 text-[13px] ${mesaSelectionChipSoftClass(isOn)}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {groupsForItem.length === 0 ? (
          <p className="text-[13px] text-brand-text-muted">{t.noQuickNotes}</p>
        ) : null}
      </div>
    </div>
  );
}
