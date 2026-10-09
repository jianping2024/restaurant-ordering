import 'server-only';

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MENU_IMAGE_MAX_BYTES,
  pathFromMenuImagePublicUrl,
  toMenuImagePublicRef,
} from '@/lib/menu-image';
import {
  STOREFRONT_IMAGE_MAX_BYTES,
  storefrontImageObjectPath,
  type StorefrontImageKind,
} from '@/lib/restaurant-storefront-image';

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const COLUMN_BY_KIND: Record<StorefrontImageKind, 'cover_url' | 'logo_url'> = {
  cover: 'cover_url',
  logo: 'logo_url',
};

export type StorefrontImageMutationError = {
  error: string;
  message?: string;
  status: number;
};

export type StorefrontImageMutationOk = {
  kind: StorefrontImageKind;
  url: string | null;
};

async function removeStorefrontImageObject(
  admin: SupabaseClient,
  publicUrl: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!publicUrl?.trim()) return { ok: true };
  const path = pathFromMenuImagePublicUrl(publicUrl);
  if (!path) return { ok: true };
  const { error } = await admin.storage.from('menu-images').remove([path]);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Sole write path: cover_url / logo_url via menu-images storefront objects. */
export async function setRestaurantStorefrontImage(
  admin: SupabaseClient,
  restaurantId: string,
  kind: StorefrontImageKind,
  file: File | null,
  stripImage: boolean,
): Promise<StorefrontImageMutationOk | StorefrontImageMutationError> {
  const column = COLUMN_BY_KIND[kind];

  const { data: existing, error: loadErr } = await admin
    .from('restaurants')
    .select(column)
    .eq('id', restaurantId)
    .maybeSingle();
  if (loadErr || !existing) {
    return { error: 'query_failed', message: loadErr?.message, status: 500 };
  }

  const previousUrl =
    typeof (existing as Record<string, unknown>)[column] === 'string' &&
    String((existing as Record<string, unknown>)[column]).trim()
      ? String((existing as Record<string, unknown>)[column]).trim()
      : null;

  let nextUrl: string | null | undefined;
  let uploadedPath: string | null = null;

  if (stripImage && !file) {
    nextUrl = null;
  } else if (file) {
    const maxBytes = Math.min(STOREFRONT_IMAGE_MAX_BYTES, MENU_IMAGE_MAX_BYTES);
    if (!ALLOWED_IMAGE_MIME.has(file.type) || file.size > maxBytes) {
      return { error: 'invalid_image', status: 400 };
    }
    const path = storefrontImageObjectPath(restaurantId, kind, file.type, randomUUID());
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from('menu-images').upload(path, buffer, {
      upsert: false,
      contentType: file.type,
      cacheControl: '3600',
    });
    if (uploadError) {
      return { error: 'upload_failed', message: uploadError.message, status: 500 };
    }
    uploadedPath = path;
    nextUrl = toMenuImagePublicRef(path);
  }

  if (nextUrl === undefined) {
    return { kind, url: previousUrl };
  }

  const { error: updateErr } = await admin
    .from('restaurants')
    .update({ [column]: nextUrl })
    .eq('id', restaurantId);
  if (updateErr) {
    if (uploadedPath) {
      await admin.storage.from('menu-images').remove([uploadedPath]);
    }
    return { error: 'update_failed', message: updateErr.message, status: 500 };
  }

  if (previousUrl && previousUrl !== nextUrl) {
    const removed = await removeStorefrontImageObject(admin, previousUrl);
    if (!removed.ok) {
      await admin.from('restaurants').update({ [column]: previousUrl }).eq('id', restaurantId);
      if (uploadedPath) {
        await admin.storage.from('menu-images').remove([uploadedPath]);
      }
      return { error: 'cleanup_failed', message: removed.message, status: 500 };
    }
  }

  return { kind, url: nextUrl };
}
