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
            data: { id: 'sess-existing', status: 'open' },
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
  assert.deepEqual(result.session, { id: 'sess-existing', status: 'open' });
  assert.equal(result.error, null);
});

test('ensureOpenTableSession creates session with opener when none exists', async () => {
  let sawInsert = false;
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
          return Promise.resolve({ data: null, error: null });
        },
        insert(payload: Record<string, unknown>) {
          sawInsert = true;
          assert.deepEqual(payload, {
            restaurant_id: 'r1',
            table_id: 't1',
            status: 'open',
            opened_by_user_id: 'u1',
          });
          return {
            select() {
              return this;
            },
            single() {
              return Promise.resolve({
                data: { id: 'sess-new', status: 'open' },
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

  assert.equal(sawInsert, true);
  assert.deepEqual(result.session, { id: 'sess-new', status: 'open' });
  assert.equal(result.error, null);
});
