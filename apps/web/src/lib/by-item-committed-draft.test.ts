import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  byItemDraftHasNamedRows,
  extractByItemDraftAllocations,
  extractByItemLockedAllocations,
  mergeByItemCommittedAndDraft,
  pruneByItemDraftAgainstLocks,
} from './by-item-committed-draft';
import type { ByItemConsumerRow } from './bill-split-by-item';
import { createByItemConsumerRow } from './bill-split-by-item';
import {
  addBuffetSeatToPerson,
  addWholeShareToPerson,
  removePersonShareOnLine,
  staffByItemPersonShares,
} from './staff-by-item-workbench';
import { withDefaultByItemLineRows } from './bill-split-by-item';
import { mintSplitPartyId } from './split-party-id';
import type { ByItemLineSpec } from './bill-split-by-item-lines';

function row(
  name: string,
  opts?: { partyId?: string; paidLocked?: boolean; qty?: string; adult?: string; child?: string },
): ByItemConsumerRow {
  return {
    id: `${name}-${opts?.partyId ?? 'x'}`,
    name,
    qtyWhole: opts?.qty ?? '1',
    qtyNum: '',
    qtyDen: '',
    adultQty: opts?.adult ?? '',
    childQty: opts?.child ?? '',
    ...(opts?.partyId ? { partyId: opts.partyId } : {}),
    ...(opts?.paidLocked ? { paidLocked: true } : {}),
  };
}

describe('by-item committed + draft layers (locked-only committed)', () => {
  it('extractLocked keeps only paidLocked / locked-ticket named rows', () => {
    const locked = new Set(['p:party-paid']);
    const working = {
      'line-a': [
        row('客人 1', { partyId: 'party-paid', paidLocked: true }),
        row('客人 2', { partyId: 'party-open', qty: '1' }),
        { ...createByItemConsumerRow({ seed: true }), name: '' },
      ],
    };
    const lockedRows = extractByItemLockedAllocations(working, locked);
    assert.equal(lockedRows['line-a']?.length, 1);
    assert.equal(lockedRows['line-a']?.[0]?.partyId, 'party-paid');
  });

  it('merge keeps unlocked draft when committed has only locked peers', () => {
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

  it('merge does not resurrect unlocked committed twin after draft delete', () => {
    const partyId = 'party-open';
    const locked = new Set<string>();
    // Bug contract: unlocked must NOT sit in committed. If it wrongly does, merge
    // still must not show it once draft no longer has that ticket.
    const committedWrong = {
      'line-a': [row('客人 1', { partyId, qty: '1', adult: '1', child: '1' })],
    };
    const draftEmpty = extractByItemDraftAllocations(
      { 'line-a': [createByItemConsumerRow({ buffet: true, seed: true })] },
      locked,
    );
    assert.equal(Object.keys(draftEmpty).length, 0);

    // Correct path: committed locked-only filter drops the unlocked twin first.
    const committed = extractByItemLockedAllocations(committedWrong, locked);
    assert.equal(Object.keys(committed).length, 0);

    const merged = mergeByItemCommittedAndDraft(committed, draftEmpty, locked);
    assert.equal(Object.keys(merged).length, 0);
  });

  it('extractDraft drops locked, paidLocked, and unnamed seeds with partyId', () => {
    const locked = new Set(['p:party-paid']);
    const seed = createByItemConsumerRow({ buffet: true, seed: true });
    assert.ok(seed.partyId);
    assert.equal(seed.name, '');
    const working = {
      'line-a': [
        row('客人 1', { partyId: 'party-paid', paidLocked: true }),
        row('客人 2', { partyId: 'party-draft', qty: '1' }),
        seed,
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

  it('byItemDraftHasNamedRows ignores seeds', () => {
    assert.equal(
      byItemDraftHasNamedRows({
        a: [createByItemConsumerRow({ seed: true })],
      }),
      false,
    );
    assert.equal(
      byItemDraftHasNamedRows({
        a: [row('客人 1', { partyId: 'p1' })],
      }),
      true,
    );
  });
});

describe('draft-layer buffet edit path (set/extract/merge)', () => {
  const buffetSpec: ByItemLineSpec = {
    key: 'buffet-0',
    mode: 'buffet',
    adults: 2,
    children: 2,
    adultUnitPrice: 19.95,
    childUnitPrice: 10,
    name: 'Buffet livre',
  };

  function makeState(committed: Record<string, ByItemConsumerRow[]>) {
    let draft: Record<string, ByItemConsumerRow[]> = {};
    const locked = new Set<string>();
    const lineSpecs = [buffetSpec];
    const read = () =>
      withDefaultByItemLineRows(
        mergeByItemCommittedAndDraft(committed, draft, locked),
        lineSpecs,
      );
    const set = (update: Record<string, ByItemConsumerRow[]> | null) => {
      if (!update) return;
      draft = extractByItemDraftAllocations(update, locked);
    };
    return { read, set, getDraft: () => draft, lineSpecs, locked };
  }

  it('stacks two adult clicks into one row', () => {
    const partyId = mintSplitPartyId();
    const s = makeState({});
    s.set(
      addBuffetSeatToPerson({
        allocations: s.read(),
        lineSpecs: s.lineSpecs,
        lineKey: 'buffet-0',
        personName: '客人 1',
        partyId,
        guestType: 'adult',
      }),
    );
    s.set(
      addBuffetSeatToPerson({
        allocations: s.read(),
        lineSpecs: s.lineSpecs,
        lineKey: 'buffet-0',
        personName: '客人 1',
        partyId,
        guestType: 'adult',
      }),
    );
    const named = s.read()['buffet-0']!.filter((r) => r.name.trim());
    assert.equal(named.length, 1);
    assert.equal(named[0]!.adultQty, '2');
  });

  it('adult then child stay on one row', () => {
    const partyId = mintSplitPartyId();
    const s = makeState({});
    s.set(
      addBuffetSeatToPerson({
        allocations: s.read(),
        lineSpecs: s.lineSpecs,
        lineKey: 'buffet-0',
        personName: '客人 1',
        partyId,
        guestType: 'adult',
      }),
    );
    s.set(
      addBuffetSeatToPerson({
        allocations: s.read(),
        lineSpecs: s.lineSpecs,
        lineKey: 'buffet-0',
        personName: '客人 1',
        partyId,
        guestType: 'child',
      }),
    );
    const named = s.read()['buffet-0']!.filter((r) => r.name.trim());
    assert.equal(named.length, 1);
    assert.equal(named[0]!.adultQty, '1');
    assert.equal(named[0]!.childQty, '1');
  });

  it('delete clears share and does not resurrect when committed is locked-only', () => {
    const partyId = mintSplitPartyId();
    const lockedPaid = mintSplitPartyId();
    const committed = extractByItemLockedAllocations(
      {
        'buffet-0': [
          row('客人 0', {
            partyId: lockedPaid,
            paidLocked: true,
            adult: '1',
            child: '',
          }),
          // unlocked twin must be filtered out of committed
          row('客人 1', { partyId, adult: '1', child: '1' }),
        ],
      },
      new Set([`p:${lockedPaid}`]),
    );
    assert.equal(committed['buffet-0']?.length, 1);
    assert.equal(committed['buffet-0']?.[0]?.partyId, lockedPaid);

    const s = makeState(committed);
    s.set(
      addBuffetSeatToPerson({
        allocations: s.read(),
        lineSpecs: s.lineSpecs,
        lineKey: 'buffet-0',
        personName: '客人 1',
        partyId,
        guestType: 'adult',
      }),
    );
    const sharesBefore = staffByItemPersonShares({
      personName: '客人 1',
      partyId,
      lineSpecs: s.lineSpecs,
      orderLines: [
        {
          key: 'buffet-0',
          name: 'Buffet livre',
          name_zh: 'Buffet livre',
          quantity: 1,
          unit_price: 19.95,
        },
      ],
      allocations: s.read(),
      lang: 'zh',
    });
    assert.equal(sharesBefore.length, 1);
    s.set(
      removePersonShareOnLine({
        allocations: s.read(),
        lineKey: 'buffet-0',
        rowId: sharesBefore[0]!.rowId,
        buffet: true,
      }),
    );
    const sharesAfter = staffByItemPersonShares({
      personName: '客人 1',
      partyId,
      lineSpecs: s.lineSpecs,
      orderLines: [
        {
          key: 'buffet-0',
          name: 'Buffet livre',
          name_zh: 'Buffet livre',
          quantity: 1,
          unit_price: 19.95,
        },
      ],
      allocations: s.read(),
      lang: 'zh',
    });
    assert.equal(sharesAfter.length, 0);
  });

  it('menu + stacks qty on one row', () => {
    const menuSpec: ByItemLineSpec = {
      key: 'tea',
      mode: 'menu',
      lineQty: 2,
      unitPrice: 2.5,
      name: 'tea',
    };
    let draft: Record<string, ByItemConsumerRow[]> = {};
    const locked = new Set<string>();
    const partyId = mintSplitPartyId();
    const read = () =>
      withDefaultByItemLineRows(
        mergeByItemCommittedAndDraft({}, draft, locked),
        [menuSpec],
      );
    const set = (update: Record<string, ByItemConsumerRow[]> | null) => {
      if (!update) return;
      draft = extractByItemDraftAllocations(update, locked);
    };
    set(
      addWholeShareToPerson({
        allocations: read(),
        lineSpecs: [menuSpec],
        lineKey: 'tea',
        personName: '客人 1',
        partyId,
      }),
    );
    set(
      addWholeShareToPerson({
        allocations: read(),
        lineSpecs: [menuSpec],
        lineKey: 'tea',
        personName: '客人 1',
        partyId,
      }),
    );
    const named = read().tea!.filter((r) => r.name.trim());
    assert.equal(named.length, 1);
    assert.equal(named[0]!.qtyWhole, '2');
  });
});
