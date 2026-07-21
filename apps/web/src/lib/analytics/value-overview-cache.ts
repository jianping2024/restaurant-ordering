import 'server-only';

import { unstable_cache } from 'next/cache';
import {
  getValueOverview,
  type GetValueOverviewResult,
} from '@/lib/analytics/analytics.service';
import type { AnalyticsRange, ValueOverviewResponse } from '@/lib/analytics/analytics.types';
import {
  VALUE_OVERVIEW_REVALIDATE_SECONDS,
  valueOverviewCacheKeyParts,
  valueOverviewCacheTag,
} from '@/lib/analytics/value-overview-cache-policy';
import { createAdminClient } from '@/lib/supabase/admin';

export {
  VALUE_OVERVIEW_REVALIDATE_SECONDS,
  valueOverviewBusinessDay,
  valueOverviewCacheTag,
} from '@/lib/analytics/value-overview-cache-policy';

type OverviewQueryCode = 'query_limit_exceeded' | 'query_failed';

function overviewQueryCode(err: unknown): OverviewQueryCode | null {
  if (!err || typeof err !== 'object') return null;
  const code = (err as { overviewQueryCode?: unknown }).overviewQueryCode;
  if (code === 'query_limit_exceeded' || code === 'query_failed') return code;
  return null;
}

function throwOverviewQueryError(code: OverviewQueryCode, message?: string): never {
  const err = new Error(message || code) as Error & { overviewQueryCode: OverviewQueryCode };
  err.overviewQueryCode = code;
  throw err;
}

/**
 * Computes a successful ValueOverview only.
 * Failures throw so `unstable_cache` does not store error payloads.
 */
async function loadValueOverviewUncached(
  restaurantId: string,
  range: AnalyticsRange,
): Promise<ValueOverviewResponse> {
  const admin = createAdminClient();
  const result = await getValueOverview(admin, restaurantId, range);
  if (!result.ok) {
    throwOverviewQueryError(result.code, result.message);
  }
  return result.data;
}

function readCachedValueOverview(
  restaurantId: string,
  range: AnalyticsRange,
  businessDay: string,
): Promise<ValueOverviewResponse> {
  return unstable_cache(
    loadValueOverviewUncached,
    ['value-overview', restaurantId, range, businessDay],
    {
      revalidate: VALUE_OVERVIEW_REVALIDATE_SECONDS,
      tags: [valueOverviewCacheTag(restaurantId)],
    },
  )(restaurantId, range);
}

/**
 * Owner-facing ValueOverview supply used by RSC + API.
 * One DTO shape; aggregation stays in `getValueOverview`; this layer only memoizes successes.
 */
export async function getCachedValueOverview(
  restaurantId: string,
  range: AnalyticsRange,
  options?: { bypassCache?: boolean; now?: Date },
): Promise<GetValueOverviewResult> {
  const now = options?.now ?? new Date();

  if (options?.bypassCache) {
    const admin = createAdminClient();
    return getValueOverview(admin, restaurantId, range, now);
  }

  const { businessDay } = valueOverviewCacheKeyParts(restaurantId, range, now);
  try {
    const data = await readCachedValueOverview(restaurantId, range, businessDay);
    return { ok: true, data };
  } catch (err) {
    const code = overviewQueryCode(err);
    if (code) {
      return {
        ok: false,
        code,
        message: err instanceof Error ? err.message : undefined,
      };
    }
    return {
      ok: false,
      code: 'query_failed',
      message: err instanceof Error ? err.message : undefined,
    };
  }
}
