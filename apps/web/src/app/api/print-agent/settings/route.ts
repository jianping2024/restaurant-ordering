/** @deprecated One-release rollback alias of `/api/restaurants/[slug]/print-agent/settings` (plan §5.4); removed in batch 2. */
import { legacyStoreApi } from '@/lib/legacy-store-api';
import { GET as storeGET } from '@/app/api/restaurants/[slug]/print-agent/settings/route';
import { PUT as storePUT } from '@/app/api/restaurants/[slug]/print-agent/settings/route';

export const runtime = 'nodejs';

export const GET = legacyStoreApi(storeGET);
export const PUT = legacyStoreApi(storePUT);
