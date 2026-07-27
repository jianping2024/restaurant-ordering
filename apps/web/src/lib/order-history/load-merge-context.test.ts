import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assembleMergeSourceRefs,
  assembleMergeTargetContext,
  collectOrderHistoryTableIds,
} from '@/lib/order-history/load-merge-context';
import { tableDisplayNameMapFromRows } from '@/lib/order-history/resolve-session-table-display';

describe('load-merge-context assembly', () => {
  const tableDisplayById = tableDisplayNameMapFromRows([
    { id: 'table-source', display_name: 'B-03' },
    { id: 'table-target', display_name: 'A-04' },
  ]);

  it('assembles merge target context', () => {
    const ctx = assembleMergeTargetContext(
      'target-session',
      tableDisplayById,
      new Map([
        [
          'target-session',
          { id: 'target-session', table_id: 'table-target', status: 'closed' },
        ],
      ]),
    );
    assert.equal(ctx?.targetDisplayName, 'A-04');
    assert.equal(ctx?.targetStatus, 'closed');
  });

  it('assembles merge source refs', () => {
    const refs = assembleMergeSourceRefs(
      'target-session',
      new Map([
        [
          'target-session',
          [
            {
              id: 'source-session',
              table_id: 'table-source',
              closed_at: '2026-07-27T12:23:29.000Z',
              merge_into_session_id: 'target-session',
            },
          ],
        ],
      ]),
      tableDisplayById,
    );
    assert.equal(refs?.[0]?.sourceDisplayName, 'B-03');
  });

  it('collects table ids from sessions and merge rows', () => {
    const ids = collectOrderHistoryTableIds(
      [{ table_id: 'table-target' }],
      new Map([
        ['target-session', { id: 'target-session', table_id: 'table-target', status: 'closed' }],
      ]),
      new Map([
        [
          'target-session',
          [
            {
              id: 'source-session',
              table_id: 'table-source',
              closed_at: '2026-07-27T12:23:29.000Z',
              merge_into_session_id: 'target-session',
            },
          ],
        ],
      ]),
    );
    assert.deepEqual(ids.sort(), ['table-source', 'table-target']);
  });
});
