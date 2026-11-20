/** @deprecated One-release rollback alias of `/api/restaurants/[slug]/system-logs` (plan §5.4); removed in batch 2. */
import { legacyStoreApi } from '@/lib/legacy-store-api';
import { GET as storeGET } from '@/app/api/restaurants/[slug]/system-logs/route';

export const dynamic = 'force-dynamic';

export const GET = legacyStoreApi(storeGET);
