'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { GUEST_MENU_DISH_LOCATE_HIGHLIGHT_MS } from '@/lib/guest-menu-dish-search';

/**
 * Switch category → wait for list paint → scroll card into view → brief highlight.
 * Sole locate path for classic + sushi guest menus.
 */
export function useGuestMenuDishLocate(params: {
  /** Ids currently rendered in the dish list (after category switch). */
  visibleItemIds: readonly string[];
  onNavigateToCategory: (topCategoryId: string) => void;
}) {
  const [highlightMenuItemId, setHighlightMenuItemId] = useState<string | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const { visibleItemIds, onNavigateToCategory } = params;

  const locateDish = useCallback(
    (dish: { id: string; topCategoryId: string }) => {
      pendingIdRef.current = dish.id;
      onNavigateToCategory(dish.topCategoryId);
      setHighlightMenuItemId(dish.id);
    },
    [onNavigateToCategory],
  );

  useLayoutEffect(() => {
    const id = pendingIdRef.current;
    if (!id) return;
    if (!visibleItemIds.includes(id)) return;
    pendingIdRef.current = null;
    const el = document.querySelector<HTMLElement>(
      `[data-menu-item-id="${CSS.escape(id)}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [visibleItemIds, highlightMenuItemId]);

  useLayoutEffect(() => {
    if (!highlightMenuItemId) return;
    const timer = window.setTimeout(() => {
      setHighlightMenuItemId((current) =>
        current === highlightMenuItemId ? null : current,
      );
    }, GUEST_MENU_DISH_LOCATE_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightMenuItemId]);

  return { highlightMenuItemId, locateDish };
}
