import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  claimAppendIdempotency,
  completeAppendIdempotency,
  parseAppendClientRequestId,
  releaseAppendIdempotencyClaim,
} from './append-idempotency';

type Row = {
  restaurant_id: string;
  session_id: string;
  client_request_id: string;
  status: string;
  order_id: string | null;
  batch_id: string | null;
  had_done_before: boolean | null;
  is_first_order: boolean | null;
  line_count?: number | null;
  updated_at?: string;
};

function createMemoryAdmin(rows: Row[]): SupabaseClient {
  const match = (filters: Record<string, unknown>) =>
    rows.find((row) => Object.entries(filters).every(([k, v]) => (row as Record<string, unknown>)[k] === v));

  const from = () => {
    const filters: Record<string, unknown> = {};
    const builder: {
      select: (cols: string) => typeof builder;
      insert: (payload: Row) => Promise<{ data: unknown; error: { message: string } | null }>;
      update: (payload: Partial<Row>) => typeof builder;
      delete: () => typeof builder;
      eq: (col: string, value: unknown) => typeof builder;
      maybeSingle: () => Promise<{ data: Row | null; error: null }>;
    } = {
      select() {
        return builder;
      },
      async insert(payload: Row) {
        if (
          rows.some(
            (row) =>
              row.session_id === payload.session_id &&
              row.client_request_id === payload.client_request_id,
          )
        ) {
          return { data: null, error: { message: 'duplicate' } };
        }
        rows.push({ ...payload });
        return { data: payload, error: null };
      },
      update(payload: Partial<Row>) {
        const run = async () => {
          const row = match(filters);
          if (row) Object.assign(row, payload);
          return { data: null, error: null };
        };
        const thenable = {
          eq(col: string, value: unknown) {
            filters[col] = value;
            return thenable;
          },
          then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
            return run().then(resolve, reject);
          },
        };
        return thenable as unknown as typeof builder;
      },
      delete() {
        const run = async () => {
          const idx = rows.findIndex((row) =>
            Object.entries(filters).every(([k, v]) => (row as Record<string, unknown>)[k] === v),
          );
          if (idx >= 0) rows.splice(idx, 1);
          return { data: null, error: null };
        };
        const thenable = {
          eq(col: string, value: unknown) {
            filters[col] = value;
            return thenable;
          },
          then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
            return run().then(resolve, reject);
          },
        };
        return thenable as unknown as typeof builder;
      },
      eq(col: string, value: unknown) {
        filters[col] = value;
        return builder;
      },
      async maybeSingle() {
        return { data: match(filters) ?? null, error: null };
      },
    };
    return builder;
  };

  return { from } as unknown as SupabaseClient;
}

describe('append-idempotency', () => {
  it('parseAppendClientRequestId normalizes uuid', () => {
    assert.equal(
      parseAppendClientRequestId('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  it('claim → complete → claim replays without a second write path', async () => {
    const rows: Row[] = [];
    const admin = createMemoryAdmin(rows);
    const base = {
      admin,
      restaurantId: 'r1',
      sessionId: 's1',
      clientRequestId: '11111111-1111-4111-8111-111111111111',
    };

    const first = await claimAppendIdempotency(base);
    assert.equal(first.kind, 'claimed');

    const done = await completeAppendIdempotency({
      admin,
      sessionId: 's1',
      clientRequestId: base.clientRequestId,
      orderId: 'o1',
      batchId: 'b1',
      hadDoneBefore: false,
      isFirstOrder: true,
      lineCount: 2,
    });
    assert.equal(done.ok, true);
    assert.equal(rows[0]?.status, 'completed');

    const second = await claimAppendIdempotency(base);
    assert.equal(second.kind, 'replay');
    if (second.kind === 'replay') {
      assert.equal(second.result.orderId, 'o1');
      assert.equal(second.result.batchId, 'b1');
      assert.equal(second.result.isFirstOrder, true);
    }
  });

  it('concurrent claim after pending insert returns in_progress', async () => {
    const rows: Row[] = [
      {
        restaurant_id: 'r1',
        session_id: 's1',
        client_request_id: '11111111-1111-4111-8111-111111111111',
        status: 'pending',
        order_id: null,
        batch_id: null,
        had_done_before: null,
        is_first_order: null,
      },
    ];
    const result = await claimAppendIdempotency({
      admin: createMemoryAdmin(rows),
      restaurantId: 'r1',
      sessionId: 's1',
      clientRequestId: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(result.kind, 'in_progress');
  });

  it('release pending allows a fresh claim', async () => {
    const rows: Row[] = [];
    const admin = createMemoryAdmin(rows);
    const clientRequestId = '11111111-1111-4111-8111-111111111111';
    const claimed = await claimAppendIdempotency({
      admin,
      restaurantId: 'r1',
      sessionId: 's1',
      clientRequestId,
    });
    assert.equal(claimed.kind, 'claimed');
    await releaseAppendIdempotencyClaim({ admin, sessionId: 's1', clientRequestId });
    const again = await claimAppendIdempotency({
      admin,
      restaurantId: 'r1',
      sessionId: 's1',
      clientRequestId,
    });
    assert.equal(again.kind, 'claimed');
  });
});
