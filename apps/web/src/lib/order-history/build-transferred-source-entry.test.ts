import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTransferredSourceEntry } from '@/lib/order-history/build-transferred-source-entry';

describe('buildTransferredSourceEntry', () => {
  it('projects transfer-out event as source-table operational row', () => {
    const entry = buildTransferredSourceEntry(
      {
        id: 'evt-1',
        session_id: 'sess-live',
        occurred_at: '2026-07-27T13:00:00.000Z',
        operator_user_id: 'user-b',
        from_table_id: 'table-a',
        to_table_id: 'table-b',
        from_display_name: 'A-01',
        to_display_name: 'B-02',
      },
      {
        opened_at: '2026-07-27T12:00:00.000Z',
        opened_by_user_id: 'user-a',
      },
      new Map([['table-b', 'B-02']]),
      new Map([
        [
          'sess-live',
          { id: 'sess-live', table_id: 'table-b', status: 'open' },
        ],
      ]),
      new Map([
        ['user-a', 'Waiter A'],
        ['user-b', 'Waiter B'],
      ]),
    );

    assert.equal(entry.historyRecordId, 'transfer:evt-1');
    assert.equal(entry.closeKind, 'transferred_source');
    assert.equal(entry.tableId, 'table-a');
    assert.equal(entry.displayName, 'A-01');
    assert.equal(entry.itemCount, 0);
    assert.equal(entry.mergeContext?.targetDisplayName, 'B-02');
    assert.equal(entry.mergeContext?.targetStatus, 'open');
    assert.equal(entry.openedByName, 'Waiter A');
    assert.equal(entry.closedByName, 'Waiter B');
    assert.equal(
      entry.lifecycleSteps.some((step) => step.kind === 'transferred_out'),
      true,
    );
    assert.equal(
      entry.lifecycleSteps.some((step) => step.kind === 'closed'),
      false,
    );
  });
});
