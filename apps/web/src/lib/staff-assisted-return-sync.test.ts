import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  isStaffAssistedMenuSubmitReturn,
  reconcileStaffAssistedMenuSubmitReturn,
} from './staff-assisted-return-sync';

describe('staff-assisted-return-sync', () => {
  it('isStaffAssistedMenuSubmitReturn detects menu_submit query', () => {
    assert.equal(
      isStaffAssistedMenuSubmitReturn(new URLSearchParams('from=menu_submit')),
      true,
    );
    assert.equal(isStaffAssistedMenuSubmitReturn(new URLSearchParams('from=waiter')), false);
  });

  it('reconcileStaffAssistedMenuSubmitReturn refreshes SSR then client detail', async () => {
    const router = {
      refresh: mock.fn(),
      replace: mock.fn(),
    };
    const refreshDetail = mock.fn(async () => ({ ok: true }));

    await reconcileStaffAssistedMenuSubmitReturn({
      router: router as never,
      pathname: '/dashboard/waiter/table-1',
      refreshDetail,
    });

    assert.equal(router.refresh.mock.calls.length, 1);
    assert.equal(refreshDetail.mock.calls.length, 1);
    assert.deepEqual(router.replace.mock.calls[0]?.arguments, ['/dashboard/waiter/table-1']);
  });
});
