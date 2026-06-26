import assert from 'node:assert/strict';
import test from 'node:test';
import { insertOpenTableSession } from './table-session-open';

test('insertOpenTableSession retries without opener when column is missing', async () => {
  let insertCalls = 0;
  const admin = {
    from(table: string) {
      assert.equal(table, 'table_sessions');
      return {
        insert(payload: Record<string, unknown>) {
          insertCalls += 1;
          const hasOpener = 'opened_by_user_id' in payload;
          return {
            select() {
              return this;
            },
            single() {
              if (hasOpener) {
                return Promise.resolve({
                  data: null,
                  error: { code: '42703', message: 'column opened_by_user_id does not exist' },
                });
              }
              return Promise.resolve({
                data: { id: 'sess-1', status: 'open' },
                error: null,
              });
            },
          };
        },
      };
    },
  };

  const result = await insertOpenTableSession(admin as never, {
    restaurant_id: 'r1',
    table_id: 't1',
    opened_by_user_id: 'u1',
  });

  assert.equal(insertCalls, 2);
  assert.deepEqual(result.data, { id: 'sess-1', status: 'open' });
  assert.equal(result.error, null);
});
