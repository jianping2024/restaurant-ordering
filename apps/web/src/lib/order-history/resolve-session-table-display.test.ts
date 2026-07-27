import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveSessionTableDisplayName,
  tableDisplayNameMapFromRows,
} from '@/lib/order-history/resolve-session-table-display';

describe('resolveSessionTableDisplayName', () => {
  const tableMap = tableDisplayNameMapFromRows([
    { id: 'table-a', display_name: 'A-04' },
  ]);

  it('prefers restaurant_tables display name', () => {
    assert.equal(
      resolveSessionTableDisplayName('table-a', tableMap, []),
      'A-04',
    );
  });

  it('falls back to order snapshot when table row missing', () => {
    assert.equal(
      resolveSessionTableDisplayName(
        'table-b',
        tableMap,
        [{ display_name: 'B-01' } as never],
      ),
      'B-01',
    );
  });

  it('never falls back to table UUID', () => {
    assert.equal(
      resolveSessionTableDisplayName('c72b4f69-b8a8-42d1-bd94-be48c548102f', tableMap, []),
      '—',
    );
  });
});
