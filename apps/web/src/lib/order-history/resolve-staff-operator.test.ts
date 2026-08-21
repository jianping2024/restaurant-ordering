import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveStaffOperatorNames } from './resolve-staff-operator';

describe('resolveStaffOperatorNames', () => {
  it('reuses audit staff label then Auth username (no parallel label helper)', async () => {
    const admin = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return Promise.resolve({
              data: [
                { user_id: 'u-login-only', display_name: '', login_name: 'siyu' },
                { user_id: 'u-both', display_name: '张三', login_name: 'zhangsan' },
              ],
              error: null,
            });
          },
        };
      },
      auth: {
        admin: {
          getUserById(userId: string) {
            if (userId === 'u-admin') {
              return Promise.resolve({
                data: { user: { email: 'admin@mesa.local' } },
                error: null,
              });
            }
            return Promise.resolve({ data: { user: null }, error: null });
          },
        },
      },
    };

    const names = await resolveStaffOperatorNames(admin as never, {
      restaurantId: 'r1',
      ownerId: 'owner-1',
      restaurantName: 'Pirata',
      userIds: ['u-login-only', 'u-both', 'u-admin', 'owner-1'],
    });

    // resolveStaffOperatorDisplayName: login wins when present
    assert.equal(names.get('u-login-only'), 'siyu');
    assert.equal(names.get('u-both'), 'zhangsan');
    assert.equal(names.get('u-admin'), 'admin');
    assert.equal(names.get('owner-1'), 'Pirata');
  });
});
