import imageCompression from 'browser-image-compression';
import { extensionForImageMime, MENU_IMAGE_ACCEPT } from '@/lib/menu-image';

export const STOREFRONT_IMAGE_ACCEPT = MENU_IMAGE_ACCEPT;
export const STOREFRONT_IMAGE_MAX_BYTES = 1048576;

const TARGET_MB = 0.95;
const COVER_MAX_DIMENSION = 1600;
const LOGO_MAX_DIMENSION = 512;

export type StorefrontImageKind = 'cover' | 'logo';

export function storefrontImageObjectPath(
  restaurantId: string,
  kind: StorefrontImageKind,
  mime: string,
  objectKey: string,
): string {
  const key = objectKey.trim();
  if (!key) throw new Error('storefront_image_object_key_empty');
  return `${restaurantId}/storefront/${kind}-${key}.${extensionForImageMime(mime)}`;
}

/** Client preprocess before storefront cover/logo upload (sole compress path). */
export async function compressStorefrontImageFile(
  file: File,
  kind: StorefrontImageKind,
): Promise<File> {
  if (file.size > STOREFRONT_IMAGE_MAX_BYTES * 8) {
    throw new Error('image_too_large');
  }
  const maxWidthOrHeight = kind === 'cover' ? COVER_MAX_DIMENSION : LOGO_MAX_DIMENSION;
  const compressed = await imageCompression(file, {
    maxSizeMB: TARGET_MB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
  });
  if (compressed.size > STOREFRONT_IMAGE_MAX_BYTES) {
    throw new Error('image_too_large');
  }
  return compressed;
}
