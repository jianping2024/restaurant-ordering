'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MenuItemFlavorChips } from '@/components/menu/MenuItemFlavorChips';
import { resolveMenuItemAllergenPresentation } from '@/lib/allergens';
import type { KitchenBoardMenuCatalogEntry } from '@/lib/kitchen-board-menu-catalog';
import {
  formatOnScreenMenuItemLabel,
  resolveMenuItemLocalizedDescription,
  resolveMenuItemLocalizedName,
} from '@/lib/menu-item-display';
import {
  MENU_IMAGE_OBJECT_FIT_CLASS,
  MENU_IMAGE_UNOPTIMIZED,
  MENU_IMAGE_WELL_BG_CLASS,
  resolveMenuImageDisplayUrl,
} from '@/lib/menu-image';
import type { UILanguage } from '@/lib/i18n';
import type { Language } from '@/types';

type Labels = {
  detailConfirm: string;
  detailDescriptionEmpty: string;
  detailAllergensTitle: string;
  detailAllergensUnmarked: string;
  detailVegetarianBadge: string;
};

type Props = {
  open: boolean;
  entry: KitchenBoardMenuCatalogEntry | null;
  lang: UILanguage;
  flavorHintsEnabled: boolean;
  labels: Labels;
  onClose: () => void;
};

/**
 * Sole kitchen-board read-only dish detail (catalog snapshot frozen at open).
 * Confirm closes; not CustomerMenuItemDetailSheet (no cart / notes / qty).
 */
export function KitchenMenuItemDetailModal({
  open,
  entry,
  lang,
  flavorHintsEnabled,
  labels,
  onClose,
}: Props) {
  if (!entry) return null;

  const language = lang as Language;
  const name =
    resolveMenuItemLocalizedName(entry, language) || entry.name_pt || entry.id;
  const title = formatOnScreenMenuItemLabel(name, entry.item_code ?? null);
  const description = resolveMenuItemLocalizedDescription(entry, language)?.trim() || '';
  const allergens = resolveMenuItemAllergenPresentation(entry.allergen_codes, language);
  const src = resolveMenuImageDisplayUrl(entry.image_url) || entry.image_url || null;

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="flex flex-col gap-4">
        <div
          className={`relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl ${MENU_IMAGE_WELL_BG_CLASS} flex items-center justify-center text-6xl`}
        >
          {src ? (
            <Image
              src={src}
              alt=""
              fill
              className={MENU_IMAGE_OBJECT_FIT_CLASS}
              unoptimized={MENU_IMAGE_UNOPTIMIZED}
              sizes="(max-width: 512px) 100vw, 384px"
            />
          ) : (
            entry.emoji || '🍽️'
          )}
        </div>

        {entry.is_vegetarian ? (
          <p className="text-base font-medium text-emerald-800">{labels.detailVegetarianBadge}</p>
        ) : null}

        <MenuItemFlavorChips
          flavorCodes={entry.flavor_codes}
          lang={language}
          enabled={flavorHintsEnabled}
          variant="inline"
        />

        <div>
          <p className="text-sm font-medium text-brand-text-muted">{labels.detailAllergensTitle}</p>
          {allergens.status === 'marked' ? (
            <p className="mt-1 text-lg text-brand-text">
              {allergens.items.map((item) => item.label).join(' · ')}
            </p>
          ) : (
            <p className="mt-1 text-lg text-brand-text-muted">{labels.detailAllergensUnmarked}</p>
          )}
        </div>

        <div>
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-brand-text">
            {description || labels.detailDescriptionEmpty}
          </p>
        </div>

        <div className="border-t border-brand-border/60 pt-4">
          <Button type="button" variant="gold" size="action" className="w-full" onClick={onClose}>
            {labels.detailConfirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
