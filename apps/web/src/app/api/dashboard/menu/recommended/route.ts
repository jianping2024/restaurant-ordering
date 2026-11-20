/** @deprecated One-release rollback alias of `/api/restaurants/[slug]/menu/recommended` (plan §5.4); removed in batch 2. */
import { legacyStoreApi } from '@/lib/legacy-store-api';
import { POST as storePOST, PATCH as storePATCH, DELETE as storeDELETE } from '@/app/api/restaurants/[slug]/menu/recommended/route';

export const runtime = 'nodejs';

export const POST = legacyStoreApi(storePOST);
export const PATCH = legacyStoreApi(storePATCH);
export const DELETE = legacyStoreApi(storeDELETE);
