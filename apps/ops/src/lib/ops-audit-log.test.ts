import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { auditLogRowsToCsv, enrichAuditLogRows, type AuditLogDbRow } from './ops-audit-log';

const sampleRow: AuditLogDbRow = {
  id: 'log-1',
  actor_user_id: 'user-a',
  action: 'restaurant.update',
  target_type: 'restaurant',
  target_id: 'rest-1',
  restaurant_id: 'rest-1',
  metadata: { field: 'name', note: 'comma, here' },
  created_at: '2026-06-24T12:00:00.000Z',
};

function mockAdmin() {
  return {
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: id === 'user-a' ? { email: 'admin@test.mesa.local' } : null },
        }),
      },
    },
    from: (table: string) => ({
      select: () => ({
        in: async () =>
          table === 'restaurants'
            ? { data: [{ id: 'rest-1', name: 'Demo Bistro' }] }
            : { data: [] },
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('enrichAuditLogRows', () => {
  it('joins actor email and restaurant name', async () => {
    const items = await enrichAuditLogRows(mockAdmin(), [sampleRow]);
    assert.equal(items.length, 1);
    assert.equal(items[0].actorEmail, 'admin@test.mesa.local');
    assert.equal(items[0].restaurantName, 'Demo Bistro');
    assert.equal(items[0].restaurantId, 'rest-1');
  });

  it('handles null actor and restaurant', async () => {
    const row: AuditLogDbRow = {
      ...sampleRow,
      actor_user_id: null,
      restaurant_id: null,
    };
    const items = await enrichAuditLogRows(mockAdmin(), [row]);
    assert.equal(items[0].actorEmail, null);
    assert.equal(items[0].restaurantName, null);
  });
});

describe('auditLogRowsToCsv', () => {
  it('includes header and escaped CSV cells', () => {
    const csv = auditLogRowsToCsv(
      [sampleRow],
      new Map([['user-a', 'admin@test.mesa.local']]),
      new Map([['rest-1', 'Demo Bistro']]),
    );
    const lines = csv.split('\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^时间,操作人,操作,目标类型,目标ID,餐厅,餐厅ID,元数据$/);
    assert.match(lines[1], /admin@test\.mesa\.local/);
    assert.match(lines[1], /Demo Bistro/);
    assert.match(lines[1], /"comma, here"/);
  });

  it('returns header only for empty rows', () => {
    const csv = auditLogRowsToCsv([], new Map(), new Map());
    assert.equal(csv.split('\n').length, 1);
  });
});
