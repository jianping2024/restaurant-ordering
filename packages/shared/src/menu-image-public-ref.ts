/**
 * Sole formatter for `menu_items.image_url` public refs (Storage object → persisted string).
 *
 * Mode B same-origin: root-relative so LAN vs public host both work.
 * Cloud / non same-origin: absolute URL under the published Supabase origin.
 */

/**
 * Mode B browser same-origin flag (`NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`).
 *
 * Default (no `env` arg): reads `process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`
 * via a **direct** property access so Next.js can inline it into the client bundle.
 * Do **not** call as `menuImageSameOriginEnabled(process.env)` — nested `env.NEXT_PUBLIC_*`
 * is not inlined, and the browser then falls back to a baked LAN `NEXT_PUBLIC_SUPABASE_URL`
 * (HTTPS page → Mixed Content on `ws://`).
 *
 * Pass an `env` object only in tests / Node scripts.
 */
export function menuImageSameOriginEnabled(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): boolean {
  const raw =
    env !== undefined
      ? env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN
      : process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN;
  const v = (raw || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export type MenuImagePublicRefOptions = {
  sameOrigin: boolean;
  /** Required when sameOrigin is false. Trailing slash optional. */
  publishedOrigin: string;
};

/** Persistable public ref for a `menu-images` object path (`{restaurantId}/{itemId}.ext`). */
export function toMenuImagePublicRef(
  objectPath: string,
  options: MenuImagePublicRefOptions,
): string {
  const path = objectPath.replace(/^\/+/, '');
  if (!path) {
    throw new Error('menu_image_object_path_empty');
  }
  if (options.sameOrigin) {
    return `/storage/v1/object/public/menu-images/${path}`;
  }
  const base = (options.publishedOrigin || '').trim().replace(/\/$/, '');
  if (!base) {
    throw new Error('menu_image_published_origin_required');
  }
  return `${base}/storage/v1/object/public/menu-images/${path}`;
}
