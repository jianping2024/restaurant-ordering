import type { SupabaseClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';
import { toMenuImagePublicRef as formatMenuImagePublicRef } from '@mesa/shared';
import { getPublishedSupabaseUrl, isSupabaseBrowserSameOrigin } from '@/lib/supabase/url';

/** 与 storage bucket file_size_limit 一致（1MB） */
export const MENU_IMAGE_MAX_BYTES = 1048576;

export const MENU_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * Sole menu photo aspect ratio (upload center-crop contract).
 * Detail hero uses matching Tailwind `aspect-[4/3]` — keep in sync.
 */
export const MENU_IMAGE_ASPECT_RATIO = 4 / 3;

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

export function menuImageObjectPath(restaurantId: string, menuItemId: string, mime: string): string {
  return `${restaurantId}/${menuItemId}.${extensionForImageMime(mime)}`;
}

/**
 * Sole center-crop window for menu photos → {@link MENU_IMAGE_ASPECT_RATIO}.
 * Wider sources lose left/right; taller sources lose top/bottom.
 */
export function menuImageCenterCropRect(
  sourceWidth: number,
  sourceHeight: number,
  aspect: number = MENU_IMAGE_ASPECT_RATIO,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!(sourceWidth > 0 && sourceHeight > 0 && aspect > 0)) {
    return { sx: 0, sy: 0, sw: Math.max(0, sourceWidth), sh: Math.max(0, sourceHeight) };
  }
  const srcAspect = sourceWidth / sourceHeight;
  if (srcAspect > aspect) {
    const sw = sourceHeight * aspect;
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
  }
  if (srcAspect < aspect) {
    const sh = sourceWidth / aspect;
    return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
  }
  return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
}

function outputMimeForCroppedMenuImage(sourceMime: string): string {
  if (sourceMime === 'image/png' || sourceMime === 'image/webp') return sourceMime;
  return 'image/jpeg';
}

/**
 * Center-crop to {@link MENU_IMAGE_ASPECT_RATIO}, optionally downscale longest edge.
 * Browser-only (canvas). Used only by {@link compressMenuImageForUpload}.
 */
async function cropMenuImageFileToAspect(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const { sx, sy, sw, sh } = menuImageCenterCropRect(
      bitmap.width,
      bitmap.height,
      MENU_IMAGE_ASPECT_RATIO,
    );
    let outW = Math.max(1, Math.round(sw));
    let outH = Math.max(1, Math.round(sh));
    const longest = Math.max(outW, outH);
    if (longest > MENU_IMAGE_MAX_DIMENSION) {
      const scale = MENU_IMAGE_MAX_DIMENSION / longest;
      outW = Math.max(1, Math.round(outW * scale));
      outH = Math.max(1, Math.round(outH * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('menu image canvas unavailable');
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);

    const mime = outputMimeForCroppedMenuImage(file.type);
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
 */
export function toMenuImagePublicRef(objectPath: string): string {
  return formatMenuImagePublicRef(objectPath, {
    sameOrigin: isSupabaseBrowserSameOrigin(),
    publishedOrigin: getPublishedSupabaseUrl(),
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
 * center-crop to {@link MENU_IMAGE_ASPECT_RATIO}, then compress/scale.
 * - GIF skipped (keep animation; not aspect-guaranteed)
 * - On failure, return original for validateMenuImageFile to gate
 */
export async function compressMenuImageForUpload(file: File): Promise<File> {
  if (!ALLOWED_MIME.has(file.type)) return file;
  if (file.type === 'image/gif') return file;

  try {
    const cropped = await cropMenuImageFileToAspect(file);
    const compressed = await imageCompression(cropped, {
      maxSizeMB: MENU_IMAGE_TARGET_MB,
      maxWidthOrHeight: MENU_IMAGE_MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: cropped.type,
    });

    return new File([compressed], cropped.name, {
      type: compressed.type || cropped.type,
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

const LOCAL_SUPABASE_STORAGE_ORIGINS = [
  'http://127.0.0.1:54321',
  'http://localhost:54321',
] as const;

export type ResolveMenuImageDisplayOptions = {
  /** LAN CLI rewrite host (non same-origin `:54321` only). */
  clientHostname?: string | null;
  /** Request page origin for same-origin absolute→current-host rewrite (SSR/API). */
  pageOrigin?: string | null;
};

/**
 * Sole display resolver for menu Storage URLs.
 * - Root-relative `/storage/v1/...` → unchanged (browser uses page origin).
 * - Same-origin Mode B + absolute menu-images URL → `{pageOrigin|window.origin}/storage/...`.
 * - Local CLI `:54321` loopback → LAN host rewrite for phones.
 * - Cloud Supabase absolute URLs → unchanged.
 */
export function resolveMenuImageDisplayUrl(
  url: string | null | undefined,
  options?: ResolveMenuImageDisplayOptions,
): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();

  if (trimmed.startsWith('/storage/v1/')) {
    return trimmed;
  }

  const storagePath = pathFromMenuImagePublicUrl(trimmed);
  if (storagePath && isSupabaseBrowserSameOrigin()) {
    const origin =
      options?.pageOrigin?.replace(/\/$/, '') ||
      (typeof window !== 'undefined' ? window.location.origin : null);
    if (origin) {
      return `${origin}/storage/v1/object/public/menu-images/${storagePath}`;
    }
  }

  const hostname =
    options?.clientHostname ??
    (typeof window !== 'undefined' ? window.location.hostname : null);
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return trimmed;
  }
  for (const origin of LOCAL_SUPABASE_STORAGE_ORIGINS) {
    if (trimmed.startsWith(`${origin}/`)) {
      return trimmed.replace(origin, `http://${hostname}:54321`);
    }
  }
  return trimmed;
}

/** Hostname from Host header (no port). Sole header reader — Request/RSC wrappers use this. */
export function clientHostnameFromHeaders(headerBag: Headers): string | null {
  const fromHeader = headerBag.get('host')?.split(':')[0]?.trim();
  return fromHeader || null;
}

export function clientHostnameFromRequest(req: Request): string {
  return clientHostnameFromHeaders(req.headers) ?? new URL(req.url).hostname;
}

/**
 * Page origin from Host + X-Forwarded-Proto (Tunnel HTTPS / LAN HTTP).
 * Sole header reader — Request/RSC wrappers use this.
 */
export function clientPageOriginFromHeaders(
  headerBag: Headers,
  fallbackProto = 'http',
): string | null {
  const host = headerBag.get('host')?.trim();
  if (!host) return null;
  const protoHeader = headerBag.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = protoHeader || fallbackProto;
  return `${proto}://${host}`;
}

/** Prefer forwarded proto + Host so Tunnel HTTPS and LAN HTTP both work. */
export function clientPageOriginFromRequest(req: Request): string {
  const urlProto = new URL(req.url).protocol.replace(/:$/, '') || 'http';
  return clientPageOriginFromHeaders(req.headers, urlProto) ?? new URL(req.url).origin;
}

/** Rewrite menu item image URLs for the requesting client (LAN / same-origin). */
export function mapCustomerMenuCatalogImageUrls<
  T extends { menuItems: Array<{ image_url?: string | null }> },
>(
  catalog: T,
  clientHostnameOrOptions: string | ResolveMenuImageDisplayOptions,
): T {
  const options: ResolveMenuImageDisplayOptions =
    typeof clientHostnameOrOptions === 'string'
      ? { clientHostname: clientHostnameOrOptions }
      : clientHostnameOrOptions;
  return {
    ...catalog,
    menuItems: catalog.menuItems.map((item) => ({
      ...item,
      image_url: resolveMenuImageDisplayUrl(item.image_url, options),
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
