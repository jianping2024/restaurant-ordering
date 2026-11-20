/** @deprecated One-release rollback alias of `/api/restaurants/[slug]/print-agent/bill-receipt-printer` (plan §5.4); removed in batch 2. */
import { legacyStoreApi } from '@/lib/legacy-store-api';
import { PATCH as storePATCH } from '@/app/api/restaurants/[slug]/print-agent/bill-receipt-printer/route';

export const runtime = 'nodejs';

export const PATCH = legacyStoreApi(storePATCH);
