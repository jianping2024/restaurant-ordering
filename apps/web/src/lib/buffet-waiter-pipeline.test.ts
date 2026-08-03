import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buffetWaiterOpenIntentFromSession,
  parseBuffetWaiterOpenIntent,
} from '@/lib/buffet-waiter-open-intent';
import {
  sessionMetaFromEnsuredSession,
  tableSessionRefFromRow,
} from '@/lib/waiter-table-session-meta';

describe('parseBuffetWaiterOpenIntent', () => {
  it('accepts only open and save', () => {
    assert.equal(parseBuffetWaiterOpenIntent('open'), 'open');
    assert.equal(parseBuffetWaiterOpenIntent('save'), 'save');
    assert.equal(parseBuffetWaiterOpenIntent(''), null);
    assert.equal(parseBuffetWaiterOpenIntent(undefined), null);
  });
});

describe('buffetWaiterOpenIntentFromSession', () => {
  it('maps idle confirm to open and occupied save to save', () => {
    assert.equal(buffetWaiterOpenIntentFromSession(false), 'open');
    assert.equal(buffetWaiterOpenIntentFromSession(true), 'save');
  });
});

describe('buffet waiter session helpers', () => {
  it('tableSessionRefFromRow maps session row fields', () => {
    const ref = tableSessionRefFromRow({
      id: 'sess-1',
      table_id: 'table-1',
      opened_at: '2026-01-01T10:00:00.000Z',
      status: 'open',
    });
    assert.deepEqual(ref, {
      id: 'sess-1',
      status: 'open',
      opened_at: '2026-01-01T10:00:00.000Z',
    });
  });

  it('sessionMetaFromEnsuredSession prefers pre-fetched session row', () => {
    const row = {
      id: 'sess-1',
      table_id: 'table-1',
      opened_at: '2026-01-01T10:00:00.000Z',
      status: 'open',
    };
    const meta = sessionMetaFromEnsuredSession(row, tableSessionRefFromRow(row));
    assert.deepEqual(meta, {
      sessionId: 'sess-1',
      openedAt: '2026-01-01T10:00:00.000Z',
      status: 'open',
    });
  });

  it('sessionMetaFromEnsuredSession uses ensured session after insert (开台)', () => {
    const meta = sessionMetaFromEnsuredSession(null, {
      id: 'sess-new',
      status: 'open',
      opened_at: '2026-01-01T11:00:00.000Z',
    });
    assert.deepEqual(meta, {
      sessionId: 'sess-new',
      openedAt: '2026-01-01T11:00:00.000Z',
      status: 'open',
    });
  });
});
