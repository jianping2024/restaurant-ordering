import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import type { Language, MenuItem } from '@/types';

/** Sole peer-float dish identity: catalog photo else that dish's emoji. */
export type PeerFloatThumb = {
  imageUrl: string | null | undefined;
  emoji: string;
};

/**
 * Sole peer-float thumb resolve: live catalog row when present (photo + emoji),
 * else order-line emoji fallback. Never mint a second emoji into label text.
 */
export function resolvePeerFloatThumb(params: {
  menu: Pick<MenuItem, 'image_url' | 'emoji'> | undefined;
  fallbackEmoji?: string | null;
}): PeerFloatThumb {
  const fromMenu = typeof params.menu?.emoji === 'string' ? params.menu.emoji.trim() : '';
  const fromFallback =
    typeof params.fallbackEmoji === 'string' ? params.fallbackEmoji.trim() : '';
  return {
    imageUrl: params.menu?.image_url,
    emoji: fromMenu || fromFallback || '🍽️',
  };
}

/** Sole peer-float label: localized name + × qty (no emoji prefix). */
export function formatPeerFloatLabel(
  item: {
    name?: string;
    name_pt?: string;
    name_en?: string;
    name_zh?: string;
  },
  qty: number,
  lang: Language,
): string {
  const name = resolveMenuItemLocalizedName(
    {
      name: item.name,
      name_pt: item.name_pt || item.name || '',
      name_en: item.name_en,
      name_zh: item.name_zh,
    },
    lang,
  );
  const n = Number(qty) || 0;
  return `${name} × ${n}`;
}
