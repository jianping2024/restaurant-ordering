import { MENU_IMAGE_MAX_BYTES } from '@/lib/menu-image';

/**
 * Sole dish motion-video catalog (Pro `menu_dish_video`).
 * Videos are encoded in the staff browser from the dish photo (`menu-dish-video-encode`)
 * and stored next to it; DB columns `menu_items.video_url | rail_video_url | video_effect`.
 */
export const DISH_VIDEO_EFFECTS = ['push', 'steam', 'gloss', 'pan', 'bubbles', 'frost'] as const;
export type DishVideoEffect = (typeof DISH_VIDEO_EFFECTS)[number];

export const DEFAULT_DISH_VIDEO_EFFECT: DishVideoEffect = 'push';

export function isDishVideoEffect(value: unknown): value is DishVideoEffect {
  return typeof value === 'string' && (DISH_VIDEO_EFFECTS as readonly string[]).includes(value);
}

/** Sole i18n key map for effect chips (dish form + batch panel) — `menuManager` keys. */
export const DISH_VIDEO_EFFECT_MESSAGE_KEYS = {
  push: { label: 'dishVideoEffectPush', hint: 'dishVideoEffectPushHint' },
  steam: { label: 'dishVideoEffectSteam', hint: 'dishVideoEffectSteamHint' },
  gloss: { label: 'dishVideoEffectGloss', hint: 'dishVideoEffectGlossHint' },
  pan: { label: 'dishVideoEffectPan', hint: 'dishVideoEffectPanHint' },
  bubbles: { label: 'dishVideoEffectBubbles', hint: 'dishVideoEffectBubblesHint' },
  frost: { label: 'dishVideoEffectFrost', hint: 'dishVideoEffectFrostHint' },
} as const;

/** Batch gate: has still photo and no motion video yet (existing motion never enters batch). */
export function menuItemEligibleForDishVideoBatch(item: {
  image_url?: string | null;
  video_url?: string | null;
}): boolean {
  return Boolean(item.image_url) && !item.video_url;
}

/** Same cap as the photo bucket limit — each mp4 must fit. */
export const DISH_VIDEO_MAX_BYTES = MENU_IMAGE_MAX_BYTES;

export const DISH_VIDEO_MIME = 'video/mp4';

/** 4 s seamless loop @ 30 fps. */
export const DISH_VIDEO_FPS = 30;
export const DISH_VIDEO_DURATION_SECONDS = 4;

export type DishVideoVariant = 'detail' | 'rail';

export type DishVideoEncodeTier = { width: number; height: number; bitrate: number };

/**
 * Encode ladder per variant: first tier whose mp4 is ≤ {@link DISH_VIDEO_MAX_BYTES} wins.
 * detail = guest dish-detail hero; rail = guest recommended poster (112px wide).
 */
export const DISH_VIDEO_ENCODE_TIERS: Record<DishVideoVariant, readonly DishVideoEncodeTier[]> = {
  detail: [
    { width: 960, height: 720, bitrate: 1_500_000 },
    { width: 960, height: 720, bitrate: 1_050_000 },
    { width: 960, height: 720, bitrate: 740_000 },
    { width: 640, height: 480, bitrate: 900_000 },
  ],
  rail: [
    { width: 480, height: 360, bitrate: 450_000 },
    { width: 480, height: 360, bitrate: 300_000 },
  ],
};

/** Pick the first encoded attempt that fits the byte cap (ladder order). */
export function pickDishVideoTierWithinCap(
  sizes: readonly number[],
  maxBytes: number = DISH_VIDEO_MAX_BYTES,
): number {
  return sizes.findIndex((size) => size > 0 && size <= maxBytes);
}

/**
 * Storage key for one dish video. Unique `objectKey` per upload → new public URL,
 * so the object can use the three-year `MENU_STORAGE_CACHE_CONTROL`.
 */
export function dishVideoObjectPath(
  restaurantId: string,
  menuItemId: string,
  variant: DishVideoVariant,
  objectKey: string,
): string {
  const key = objectKey.trim();
  if (!key) throw new Error('dish_video_object_key_empty');
  return `${restaurantId}/${menuItemId}/${key}-${variant}.mp4`;
}

/** Restaurant columns every dish-video gate needs (Pro grant + store switch). */
export const DISH_VIDEO_GATE_RESTAURANT_COLUMNS =
  'id, plan, pro_valid_until, license_valid_until, feature_flags' as const;

export type DishVideoGateRestaurant = {
  id: string;
  plan?: string | null;
  pro_valid_until?: string | null;
  license_valid_until?: string | null;
  feature_flags?: unknown;
};

/** Guest-facing video fields are sent only when Pro + store switch both allow it. */
export function stripMenuItemVideoFields<T extends { video_url?: string | null; rail_video_url?: string | null; video_effect?: string | null }>(
  item: T,
): T {
  if (item.video_url == null && item.rail_video_url == null && item.video_effect == null) return item;
  return { ...item, video_url: null, rail_video_url: null, video_effect: null };
}

/**
 * Guest device gate: reduced motion, data saver or 2G keep the still photo.
 * Pure so it is testable; the component reads matchMedia / navigator.connection.
 * Playback visibility / detail priority: sole `dishMotionVideoShouldPlay`
 * in `menu-dish-video-playback.ts`.
 */
export function dishVideoDeviceAllows(input: {
  reducedMotion: boolean;
  saveData?: boolean;
  effectiveType?: string;
}): boolean {
  if (input.reducedMotion || input.saveData) return false;
  const type = input.effectiveType ?? '';
  return type !== 'slow-2g' && type !== '2g';
}
