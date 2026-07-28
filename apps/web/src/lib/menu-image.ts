import type { SupabaseClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

/** 与 storage bucket file_size_limit 一致（1MB） */
export const MENU_IMAGE_MAX_BYTES = 1048576;

export const MENU_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

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
 * 在客户端自动压缩/缩放菜品图，降低上传体积与带宽成本。
 * - GIF 默认跳过（避免动图丢失动画）
 * - 若压缩失败，回退原图，由后续校验兜底
 */
export async function compressMenuImageForUpload(file: File): Promise<File> {
  if (!ALLOWED_MIME.has(file.type)) return file;
  if (file.type === 'image/gif') return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: MENU_IMAGE_TARGET_MB,
      maxWidthOrHeight: MENU_IMAGE_MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: file.type,
    });

    return new File([compressed], file.name, {
      type: compressed.type || file.type,
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

/**
 * Local dev: DB stores Storage URLs with 127.0.0.1, which phones on LAN cannot reach.
 * Rewrite to the page host so `http://<lan-ip>:54321/storage/...` loads on real devices.
 */
export function resolveMenuImageDisplayUrl(
  url: string | null | undefined,
  options?: { clientHostname?: string | null },
): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
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

export async function removeMenuImageFromStorage(
  supabase: SupabaseClient,
  publicUrl: string | null | undefined,
): Promise<void> {
  if (!publicUrl) return;
  const path = pathFromMenuImagePublicUrl(publicUrl);
  if (!path) return;
  await supabase.storage.from('menu-images').remove([path]);
}
