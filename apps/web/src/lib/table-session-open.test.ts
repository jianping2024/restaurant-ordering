import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureOpenTableSession } from './table-session-open';

test('ensureOpenTableSession returns existing active session', async () => {
  let insertCalls = 0;
  const admin = {
    from(table: string) {
      assert.equal(table, 'table_sessions');
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({
            data: {
              id: 'sess-existing',
              status: 'open',
              opened_at: '2026-01-01T00:00:00Z',
              opened_by_name: 'qiantai1',
            },
            error: null,
          });
        },
        insert() {
          insertCalls += 1;
          throw new Error('should not insert when session exists');
        },
      };
    },
  };

  const result = await ensureOpenTableSession(admin as never, {
    restaurant_id: 'r1',
    table_id: 't1',
    opened_by_user_id: 'u1',
  });

  assert.equal(insertCalls, 0);
  assert.deepEqual(result.session, {
    id: 'sess-existing',
    status: 'open',
    opened_at: '2026-01-01T00:00:00Z',
    opened_by_name: 'qiantai1',
  });
  assert.equal(result.error, null);
});

test('ensureOpenTableSession stamps opened_by_name on insert', async () => {
  let sawInsert: Record<string, unknown> | null = null;
  const admin = {
    from(table: string) {
      if (table === 'restaurants') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({
              data: { owner_id: 'owner-1', name: '白云' },
              error: null,
            });
          },
        };
      }
      if (table === 'restaurant_staff_accounts') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return Promise.resolve({
              data: [{ user_id: 'u1', display_name: '', login_name: 'qiantai1' }],
              error: null,
            });
          },
        };
      }
      assert.equal(table, 'table_sessions');
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
        insert(payload: Record<string, unknown>) {
          sawInsert = payload;
          return {
            select() {
              return this;
            },
            single() {
              return Promise.resolve({
                data: {
                  id: 'sess-new',
                  status: 'open',
                  opened_at: '2026-01-01T11:00:00Z',
                  opened_by_name: payload.opened_by_name,
                },
                error: null,
              });
            },
          };
        },
      };
    },
  };

  const result = await ensureOpenTableSession(admin as never, {
    restaurant_id: 'r1',
    table_id: 't1',
    opened_by_user_id: 'u1',
  });

  assert.deepEqual(sawInsert, {
    restaurant_id: 'r1',
    table_id: 't1',
    status: 'open',
    opened_by_user_id: 'u1',
    opened_by_name: 'qiantai1',
  });
  assert.equal(result.session?.opened_by_name, 'qiantai1');
  assert.equal(result.error, null);
});
