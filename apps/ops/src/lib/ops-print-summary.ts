import type { SupabaseClient } from '@supabase/supabase-js';

export const PRINT_FAIL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type PrintFailureRestaurant = {
  id: string;
  name: string;
  slug: string;
  failedCount: number;
};

export async function listTopPrintFailureRestaurants(
  admin: SupabaseClient,
  options: { limit: number; sinceIso: string },
): Promise<PrintFailureRestaurant[]> {
  const { data: failedJobs } = await admin
    .from('print_jobs')
    .select('restaurant_id')
    .eq('status', 'failed')
    .gte('created_at', options.sinceIso);

  const failCountByRestaurant = new Map<string, number>();
  for (const job of failedJobs || []) {
    if (!job.restaurant_id) continue;
    failCountByRestaurant.set(
      job.restaurant_id,
      (failCountByRestaurant.get(job.restaurant_id) ?? 0) + 1,
    );
  }

  const topIds = Array.from(failCountByRestaurant.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.limit)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name, slug')
    .in('id', topIds);

  const byId = new Map((restaurants || []).map((r) => [r.id, r]));
  return topIds
    .map((id) => {
      const row = byId.get(id);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        failedCount: failCountByRestaurant.get(id) ?? 0,
      };
    })
    .filter((row): row is PrintFailureRestaurant => row !== null);
}
