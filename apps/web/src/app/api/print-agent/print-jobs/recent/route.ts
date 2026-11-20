/** @deprecated One-release rollback alias of `/api/restaurants/[slug]/print-agent/print-jobs/recent` (plan §5.4); removed in batch 2. */
import { legacyStoreApi } from '@/lib/legacy-store-api';
import { GET as storeGET } from '@/app/api/restaurants/[slug]/print-agent/print-jobs/recent/route';

export const runtime = 'nodejs';

export const GET = legacyStoreApi(storeGET);
