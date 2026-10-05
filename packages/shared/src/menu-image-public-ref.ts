/**
 * Sole formatter for `menu_items.image_url` public refs (Storage object → persisted string).
 *
 * Mode B same-origin + local CLI HTTP Storage: root-relative so LAN vs public host both work.
 * Cloud: absolute URL under the published Supabase origin (`https://*.supabase.co`).
 */

/**
 * Mode B browser same-origin flag (`NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`).
 *
 * Default (no `env` arg): reads `process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`
 * via a **direct** property access so Next.js can inline it into the client bundle.
 * Do **not** pass the whole `process.env` object into this helper — nested
 * `env.NEXT_PUBLIC_*` reads are not inlined, and the browser then falls back to a
 * baked LAN `NEXT_PUBLIC_SUPABASE_URL` (HTTPS page → Mixed Content on `ws://`).
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

/**
 * Sole detector: published Supabase origin is local/on-prem HTTP Storage
 * (loopback, docker host, or RFC1918) — not cloud HTTPS.
 * Menu image refs for these origins persist root-relative (same as Mode B).
 */
export function isLocalHttpMenuImageOrigin(publishedOrigin: string): boolean {
  let url: URL;
  try {
    url = new URL(publishedOrigin.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === 'host.docker.internal'
  ) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
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
