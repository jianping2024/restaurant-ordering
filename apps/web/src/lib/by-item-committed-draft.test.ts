import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractByItemDraftAllocations,
  mergeByItemCommittedAndDraft,
  pruneByItemDraftAgainstLocks,
} from './by-item-committed-draft';
import type { ByItemConsumerRow } from './bill-split-by-item';

function row(
  name: string,
  opts?: { partyId?: string; paidLocked?: boolean; qty?: string },
): ByItemConsumerRow {
  return {
    id: `${name}-${opts?.partyId ?? 'x'}`,
    name,
    qtyWhole: opts?.qty ?? '1',
    qtyNum: '',
    qtyDen: '',
    adultQty: '',
    childQty: '',
    ...(opts?.partyId ? { partyId: opts.partyId } : {}),
    ...(opts?.paidLocked ? { paidLocked: true } : {}),
  };
}

describe('by-item committed + draft layers', () => {
  it('merge keeps unlocked draft when committed rebuilds without that ticket', () => {
    const locked = new Set(['p:party-paid']);
    const committed = {
      'line-a': [row('客人 1', { partyId: 'party-paid', paidLocked: true })],
    };
    const draft = {
      'line-a': [row('客人 2', { partyId: 'party-draft', qty: '1' })],
    };
    const merged = mergeByItemCommittedAndDraft(committed, draft, locked);
    assert.equal(merged['line-a']?.length, 2);
    assert.ok(merged['line-a']?.some((r) => r.partyId === 'party-draft'));
    assert.ok(merged['line-a']?.some((r) => r.partyId === 'party-paid'));
  });

  it('merge lets draft overlay unlocked committed shares for the same ticket', () => {
    const locked = new Set<string>();
    const committed = {
      'line-a': [row('客人 2', { partyId: 'party-open', qty: '1' })],
    };
    const draft = {
      'line-a': [row('客人 2', { partyId: 'party-open', qty: '2' })],
    };
    const merged = mergeByItemCommittedAndDraft(committed, draft, locked);
    assert.equal(merged['line-a']?.length, 1);
    assert.equal(merged['line-a']?.[0]?.qtyWhole, '2');
  });

  it('extractDraft drops locked and paidLocked rows', () => {
    const locked = new Set(['p:party-paid']);
    const working = {
      'line-a': [
        row('客人 1', { partyId: 'party-paid', paidLocked: true }),
        row('客人 2', { partyId: 'party-draft', qty: '1' }),
      ],
    };
    const draft = extractByItemDraftAllocations(working, locked);
    assert.equal(draft['line-a']?.length, 1);
    assert.equal(draft['line-a']?.[0]?.partyId, 'party-draft');
  });

  it('prune removes draft rows once their ticket locks', () => {
    const draft = {
      'line-a': [
        row('客人 1', { partyId: 'party-paid', qty: '1' }),
        row('客人 2', { partyId: 'party-open', qty: '1' }),
      ],
    };
    const pruned = pruneByItemDraftAgainstLocks(draft, new Set(['p:party-paid']));
    assert.equal(pruned['line-a']?.length, 1);
    assert.equal(pruned['line-a']?.[0]?.partyId, 'party-open');
  });
});
