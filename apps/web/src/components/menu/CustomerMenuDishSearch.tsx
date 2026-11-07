'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { getMenuCategoryLabel } from '@/lib/menu-admin';
import { formatMenuCatalogItemLabel } from '@/lib/menu-item-display';
import { formatCustomerMenuItemPrice } from '@/lib/menu-item-price-display';
import {
  buildGuestMenuDishSearchCandidates,
  matchGuestMenuDishSearch,
  type GuestMenuDishSearchCandidate,
} from '@/lib/guest-menu-dish-search';
import type { Language, MenuCategory, MenuItem } from '@/types';

type Copy = {
  dishSearchPlaceholder: string;
  dishSearchClear: string;
  dishSearchAria: string;
  dishSearchNoResults: string;
  itemFree: string;
};

type Props = {
  lang: Language;
  servedItems: readonly MenuItem[];
  topCategoryIdByItemId: ReadonlyMap<string, string>;
  topCategories: readonly MenuCategory[];
  treatZeroAsFree?: boolean;
  copy: Copy;
  onLocate: (candidate: GuestMenuDishSearchCandidate) => void;
};

/**
 * Sole guest menu dish locator: clearable Input + suggestion list → locate callback.
 * Does not replace category browsing with a filtered catalog.
 */
export function CustomerMenuDishSearch({
  lang,
  servedItems,
  topCategoryIdByItemId,
  topCategories,
  treatZeroAsFree = false,
  copy,
  onLocate,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const candidates = useMemo(
    () =>
      buildGuestMenuDishSearchCandidates({
        servedItems,
        topCategoryIdByItemId,
        topCategories,
        lang,
        labelForCategory: (cat) => getMenuCategoryLabel(cat, lang),
      }),
    [servedItems, topCategoryIdByItemId, topCategories, lang],
  );

  const hits = useMemo(
    () => matchGuestMenuDishSearch(query, candidates, lang),
    [query, candidates, lang],
  );

  const trimmed = query.trim();
  const showPanel = open && trimmed.length > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!showPanel) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showPanel]);

  const pick = (candidate: GuestMenuDishSearchCandidate) => {
    setQuery('');
    setOpen(false);
    onLocate(candidate);
  };

  return (
    <div ref={rootRef} className="relative shrink-0 border-b border-brand-border bg-brand-card px-4 py-2">
      <Input
        type="text"
        role="searchbox"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showPanel) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === 'Enter') {
            const hit = hits[activeIndex];
            if (hit) {
              e.preventDefault();
              pick(hit);
            }
            return;
          }
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={copy.dishSearchPlaceholder}
        aria-label={copy.dishSearchAria}
        aria-autocomplete="list"
        clearable
        clearLabel={copy.dishSearchClear}
        autoComplete="off"
        enterKeyHint="search"
        className="bg-brand-bg px-3 py-2 focus:ring-brand-gold/40 focus:border-brand-gold/40"
      />

      {showPanel ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={copy.dishSearchAria}
          className="absolute left-4 right-4 top-[calc(100%-2px)] z-30 max-h-72 overflow-y-auto rounded-xl border border-brand-border bg-brand-card shadow-lg"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-brand-text-muted">
              {copy.dishSearchNoResults}
            </li>
          ) : (
            hits.map((hit, index) => {
              const priceText = formatCustomerMenuItemPrice(hit.item.price, {
                freeLabel: copy.itemFree,
                treatZeroAsFree,
              });
              const active = index === activeIndex;
              return (
                <li key={hit.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left ${
                      active ? 'bg-brand-gold/12' : 'hover:bg-brand-gold/10'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pick(hit)}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-bg text-xl"
                      aria-hidden
                    >
                      {hit.item.emoji || '🍽️'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-brand-text">
                        {formatMenuCatalogItemLabel(hit.item, lang)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-brand-text-muted">
                        {hit.topCategoryLabel}
                        {hit.topCategoryLabel ? ' · ' : ''}
                        {priceText}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
