import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOpenedByNameBySessionId } from './session-opener-display';

test('resolveOpenedByNameBySessionId maps staff display names only', async () => {
  const staffUserId = '11111111-1111-1111-1111-111111111111';
  const ownerId = '22222222-2222-2222-2222-222222222222';
  const restaurantId = '33333333-3333-3333-3333-333333333333';
  const sessionId = '44444444-4444-4444-4444-444444444444';

  const admin = {
    from(table: string) {
      assert.equal(table, 'restaurant_staff_accounts');
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return Promise.resolve({
            data: [{ user_id: staffUserId, display_name: '前台' }],
          });
        },
      };
    },
  };

  const result = await resolveOpenedByNameBySessionId(
    admin as never,
    restaurantId,
    [
      { id: sessionId, opened_by_user_id: staffUserId },
      { id: 'owner', opened_by_user_id: ownerId },
      { id: 'legacy', opened_by_user_id: null },
    ],
  );

  assert.deepEqual(result, { [sessionId]: '前台' });
});
