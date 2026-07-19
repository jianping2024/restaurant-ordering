import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WaiterBoardData } from './staff-board';
import { canonicalizeForEtag, etagsMatch, waiterBoardEtag } from './staff-board-etag';

function emptyBoard(overrides: Partial<WaiterBoardData> = {}): WaiterBoardData {
  return {
    sessionMetaByTableId: {},
    checkoutRequestedTableIds: [],
    checkoutRequestedAtByTableId: {},
    tables: [],
    groups: [],
    members: [],
    parties: [],
    partyMembers: [],
    tableSummaries: [],
    restaurantHasActiveBuffets: false,
    openTableDefaults: null,
    ...overrides,
  };
}

describe('staff-board-etag', () => {
  it('is stable for key order differences', () => {
    const a = emptyBoard({
      checkoutRequestedTableIds: ['t1'],
      sessionMetaByTableId: {
        t1: { sessionId: 's1', openedAt: '2026-01-01T00:00:00Z', status: 'open' },
      },
    });
    const b = emptyBoard({
      sessionMetaByTableId: {
        t1: { status: 'open', openedAt: '2026-01-01T00:00:00Z', sessionId: 's1' },
      },
      checkoutRequestedTableIds: ['t1'],
    });
    assert.equal(canonicalizeForEtag(a), canonicalizeForEtag(b));
    assert.equal(waiterBoardEtag(a), waiterBoardEtag(b));
    assert.equal(etagsMatch(waiterBoardEtag(a), waiterBoardEtag(b)), true);
  });

  it('changes when board content changes', () => {
    const a = emptyBoard({ checkoutRequestedTableIds: ['t1'] });
    const b = emptyBoard({ checkoutRequestedTableIds: ['t2'] });
    assert.notEqual(waiterBoardEtag(a), waiterBoardEtag(b));
  });
});
