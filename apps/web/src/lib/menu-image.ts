import type { SupabaseClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';
import {
  isLocalHttpMenuImageOrigin,
  toMenuImagePublicRef as formatMenuImagePublicRef,
} from '@mesa/shared';
import { getPublishedSupabaseUrl, isSupabaseBrowserSameOrigin } from '@/lib/supabase/url';

/** 与 storage bucket file_size_limit 一致（1MB） */
export const MENU_IMAGE_MAX_BYTES = 1048576;

export const MENU_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * Sole menu photo aspect ratio (upload letterbox contract).
 * Detail hero and preview wells use matching Tailwind `aspect-[4/3]` — keep in sync.
 */
export const MENU_IMAGE_ASPECT_RATIO = 4 / 3;

/** Sole Tailwind aspect for menu photo wells (4:3). */
export const MENU_IMAGE_ASPECT_CLASS = 'aspect-[4/3]';

/** Sole Next/Image fit for menu photos — full frame in 4:3 well, no crop. */
export const MENU_IMAGE_OBJECT_FIT_CLASS = 'object-contain object-center';

/** Sole well fill — matches upload letterbox canvas `#ffffff`; contain gaps must not show grey. */
export const MENU_IMAGE_WELL_BG_CLASS = 'bg-white';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** 压缩目标：略低于 bucket 1MB 限制，留出编码波动空间 */
const MENU_IMAGE_TARGET_MB = 0.95;
const MENU_IMAGE_MAX_DIMENSION = 1280;

export function extensionForImageMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

/**
 * Storage object key for one menu photo upload.
 * Path includes a unique `objectKey` so each replace gets a new public URL (cache-bust);
 * callers must delete the previous object after the new `image_url` is committed.
 */
export function menuImageObjectPath(
  restaurantId: string,
  menuItemId: string,
  mime: string,
  objectKey: string,
): string {
  const key = objectKey.trim();
  if (!key) {
    throw new Error('menu_image_object_key_empty');
  }
  return `${restaurantId}/${menuItemId}/${key}.${extensionForImageMime(mime)}`;
}

export type MenuImageLetterboxLayout = {
  outW: number;
  outH: number;
  drawW: number;
  drawH: number;
  offsetX: number;
  offsetY: number;
};

/**
 * Sole letterbox layout for menu photos → {@link MENU_IMAGE_ASPECT_RATIO}.
 * Full source fits inside the 4:3 canvas; excess is padding (not cropped).
 */
export function menuImageLetterboxLayout(
  sourceWidth: number,
  sourceHeight: number,
  aspect: number = MENU_IMAGE_ASPECT_RATIO,
): MenuImageLetterboxLayout {
  if (!(sourceWidth > 0 && sourceHeight > 0 && aspect > 0)) {
    const w = Math.max(0, sourceWidth);
    const h = Math.max(0, sourceHeight);
    return { outW: w, outH: h, drawW: w, drawH: h, offsetX: 0, offsetY: 0 };
  }
  const srcAspect = sourceWidth / sourceHeight;
  let outW: number;
  let outH: number;
  if (srcAspect > aspect) {
    outW = sourceWidth;
    outH = sourceWidth / aspect;
  } else {
    outH = sourceHeight;
    outW = sourceHeight * aspect;
  }
  const drawW = sourceWidth;
  const drawH = sourceHeight;
  return {
    outW,
    outH,
    drawW,
    drawH,
    offsetX: (outW - drawW) / 2,
    offsetY: (outH - drawH) / 2,
  };
}

function outputMimeForLetterboxedMenuImage(sourceMime: string): string {
  if (sourceMime === 'image/png' || sourceMime === 'image/webp') return sourceMime;
  return 'image/jpeg';
}

/**
 * Letterbox to {@link MENU_IMAGE_ASPECT_RATIO}, optionally downscale longest edge.
 * Browser-only (canvas). Used only by {@link compressMenuImageForUpload}.
 */
async function letterboxMenuImageFileToAspect(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const layout = menuImageLetterboxLayout(bitmap.width, bitmap.height, MENU_IMAGE_ASPECT_RATIO);
    let outW = Math.max(1, Math.round(layout.outW));
    let outH = Math.max(1, Math.round(layout.outH));
    let scale = 1;
    const longest = Math.max(outW, outH);
    if (longest > MENU_IMAGE_MAX_DIMENSION) {
      scale = MENU_IMAGE_MAX_DIMENSION / longest;
      outW = Math.max(1, Math.round(outW * scale));
      outH = Math.max(1, Math.round(outH * scale));
    }
    const drawW = Math.max(1, Math.round(layout.drawW * scale));
    const drawH = Math.max(1, Math.round(layout.drawH * scale));
    const offsetX = Math.round(layout.offsetX * scale);
    const offsetY = Math.round(layout.offsetY * scale);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('menu image canvas unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, offsetX, offsetY, drawW, drawH);

    const mime = outputMimeForLetterboxedMenuImage(file.type);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error('menu image toBlob failed'))),
        mime,
        0.92,
      );
    });

    const ext = extensionForImageMime(mime);
    const base = file.name.replace(/\.[^.]+$/, '') || 'menu-image';
    return new File([blob], `${base}.${ext}`, {
      type: mime,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

/**
 * Sole app writer for `menu_items.image_url` after a Storage upload.
 * Algorithm: `@mesa/shared` `toMenuImagePublicRef` — do not call `getPublicUrl` for persist.
 * Mode B same-origin + local HTTP Storage → root-relative; cloud → https absolute.
 */
export function toMenuImagePublicRef(objectPath: string): string {
  const publishedOrigin = getPublishedSupabaseUrl();
  return formatMenuImagePublicRef(objectPath, {
    sameOrigin: isSupabaseBrowserSameOrigin() || isLocalHttpMenuImageOrigin(publishedOrigin),
    publishedOrigin,
  });
}

/** 返回错误文案 key（由调用方用 i18n 解析）或 null */
export function validateMenuImageFile(
  file: File,
  messages: { imageTooLarge: string; imageTypeInvalid: string },
): string | null {
  if (!ALLOWED_MIME.has(file.type)) return messages.imageTypeInvalid;
  if (file.size > MENU_IMAGE_MAX_BYTES) return messages.imageTooLarge;
  return null;
}

/**
 * Sole client preprocess before menu photo upload:
 * letterbox to {@link MENU_IMAGE_ASPECT_RATIO}, then compress/scale.
 * - GIF skipped (keep animation; not aspect-guaranteed)
 * - On failure, return original for validateMenuImageFile to gate
 */
export async function compressMenuImageForUpload(file: File): Promise<File> {
  if (!ALLOWED_MIME.has(file.type)) return file;
  if (file.type === 'image/gif') return file;

  try {
    const letterboxed = await letterboxMenuImageFileToAspect(file);
    const compressed = await imageCompression(letterboxed, {
      maxSizeMB: MENU_IMAGE_TARGET_MB,
      maxWidthOrHeight: MENU_IMAGE_MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: letterboxed.type,
    });

    return new File([compressed], letterboxed.name, {
      type: compressed.type || letterboxed.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function pathFromMenuImagePublicUrl(url: string): string | null {
  const m = /\/object\/public\/menu-images\/(.+)$/.exec(url.trim());
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Serve menu Storage thumbs without Vercel `/_next/image` optimization.
 * Uploads are already compressed; optimization quota 402s break customer/dashboard menus.
 */
export const MENU_IMAGE_UNOPTIMIZED = true;

/** Sole catalog image_url map for staff checkout pool thumbs (menu_items rows → id → url). */
export function menuItemImageUrlLookupFromRows(
  rows: Array<{ id: string; image_url?: string | null }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const url = row.image_url?.trim();
    if (url) map[row.id] = url;
  }
  return map;
}

/**
 * Sole display resolver for menu Storage URLs.
 * - Root-relative `/storage/v1/...` → unchanged (browser uses page origin + `/storage` proxy).
 * - Local / on-prem absolute menu-images → root-relative (strip host; never bake LAN `:54321`).
 * - Cloud `https://…` menu-images → unchanged.
 */
export function resolveMenuImageDisplayUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();

  if (trimmed.startsWith('/storage/v1/')) {
    return trimmed;
  }

  const storagePath = pathFromMenuImagePublicUrl(trimmed);
  if (!storagePath) return trimmed;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  return `/storage/v1/object/public/menu-images/${storagePath}`;
}

/** Normalize catalog rows through {@link resolveMenuImageDisplayUrl} (sole display shape). */
export function mapCustomerMenuCatalogImageUrls<
  T extends { menuItems: Array<{ image_url?: string | null }> },
>(catalog: T): T {
  return {
    ...catalog,
    menuItems: catalog.menuItems.map((item) => ({
      ...item,
      image_url: resolveMenuImageDisplayUrl(item.image_url),
    })),
  };
}

export async function removeMenuImageFromStorage(
  supabase: SupabaseClient,
  publicUrl: string | null | undefined,
): Promise<void> {
  if (!publicUrl) return;
  const path = pathFromMenuImagePublicUrl(publicUrl);
  if (!path) return;
  await supabase.storage.from('menu-images').remove([path]);
}
