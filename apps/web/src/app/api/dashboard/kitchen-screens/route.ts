/** @deprecated One-release rollback alias of `/api/restaurants/[slug]/kitchen-screens` (plan §5.4); removed in batch 2. */
import { legacyStoreApi } from '@/lib/legacy-store-api';
import { GET as storeGET, POST as storePOST, PATCH as storePATCH, DELETE as storeDELETE } from '@/app/api/restaurants/[slug]/kitchen-screens/route';

export const runtime = 'nodejs';

export const GET = legacyStoreApi(storeGET);
export const POST = legacyStoreApi(storePOST);
export const PATCH = legacyStoreApi(storePATCH);
export const DELETE = legacyStoreApi(storeDELETE);
