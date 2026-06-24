import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listTopPrintFailureRestaurants } from './ops-print-summary';

type JobRow = { restaurant_id: string | null };
type RestaurantRow = { id: string; name: string; slug: string };

function mockAdmin(jobs: JobRow[], restaurants: RestaurantRow[]) {
  const printJobs = {
    select: () => ({
      eq: () => ({
        gte: async () => ({ data: jobs }),
      }),
    }),
  };
  const restaurantsTable = {
    select: () => ({
      in: async () => ({ data: restaurants }),
    }),
  };
  return {
    from: (table: string) => (table === 'print_jobs' ? printJobs : restaurantsTable),
  } as unknown as SupabaseClient;
}

describe('listTopPrintFailureRestaurants', () => {
  it('returns empty when no failed jobs', async () => {
    const rows = await listTopPrintFailureRestaurants(
      mockAdmin([], []),
      { limit: 3, sinceIso: '2026-01-01T00:00:00.000Z' },
    );
    assert.deepEqual(rows, []);
  });

  it('aggregates, sorts by count desc, and respects limit', async () => {
    const jobs: JobRow[] = [
      { restaurant_id: 'r1' },
      { restaurant_id: 'r1' },
      { restaurant_id: 'r2' },
      { restaurant_id: 'r3' },
      { restaurant_id: 'r3' },
      { restaurant_id: 'r3' },
      { restaurant_id: null },
    ];
    const restaurants: RestaurantRow[] = [
      { id: 'r1', name: 'Alpha', slug: 'alpha' },
      { id: 'r2', name: 'Beta', slug: 'beta' },
      { id: 'r3', name: 'Gamma', slug: 'gamma' },
    ];

    const rows = await listTopPrintFailureRestaurants(mockAdmin(jobs, restaurants), {
      limit: 2,
      sinceIso: '2026-01-01T00:00:00.000Z',
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, 'r3');
    assert.equal(rows[0].failedCount, 3);
    assert.equal(rows[0].name, 'Gamma');
    assert.equal(rows[1].id, 'r1');
    assert.equal(rows[1].failedCount, 2);
  });
});
