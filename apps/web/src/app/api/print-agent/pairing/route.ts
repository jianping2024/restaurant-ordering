/** @deprecated One-release rollback alias of `/api/restaurants/[slug]/print-agent/pairing` (plan §5.4); removed in batch 2. */
import { legacyStoreApi } from '@/lib/legacy-store-api';
import { POST as storePOST } from '@/app/api/restaurants/[slug]/print-agent/pairing/route';

export const runtime = 'nodejs';

export const POST = legacyStoreApi(storePOST);
