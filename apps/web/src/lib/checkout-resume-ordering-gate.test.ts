import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pruneUnpaidEmptyByItemTickets } from './checkout-by-item-collect';
import {
  prepareStaffCheckoutResumeOrdering,
  resolveCheckoutResumeOrderingNameGate,
} from './checkout-resume-ordering-gate';
import { splitPartyKey } from './split-party-id';
import type { BillSplit } from '@/types';

describe('pruneUnpaidEmptyByItemTickets', () => {
  it('drops unpaid tickets with no item_shares and keeps paid', () => {
    const paid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const empty = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const pruned = pruneUnpaidEmptyByItemTickets({
      persons: [
        {
          name: 'John',
          party_id: paid,
          item_shares: [{ key: 'cola', qty_num: 1, qty_den: 1 }],
        },
        { name: '客人 2', party_id: empty, item_shares: [] },
      ],
      result: [
        { name: 'John', amount: 2, paid: true, party_id: paid },
        { name: '客人 2', amount: 0, party_id: empty },
      ],
      lockedTicketKeys: new Set([splitPartyKey(paid, 'John')]),
    });
    assert.equal(pruned.changed, true);
    assert.equal(pruned.persons.length, 1);
    assert.equal(pruned.persons[0]?.name, 'John');
    assert.equal(pruned.result.length, 1);
    assert.equal(pruned.result[0]?.paid, true);
  });

  it('keeps unpaid tickets that still have shares', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const pruned = pruneUnpaidEmptyByItemTickets({
      persons: [
        {
          name: 'Ana',
          party_id: id,
          item_shares: [{ key: 'cola', qty_num: 1, qty_den: 1 }],
        },
      ],
      result: [{ name: 'Ana', amount: 2.2, party_id: id }],
      lockedTicketKeys: new Set(),
    });
    assert.equal(pruned.changed, false);
    assert.equal(pruned.persons.length, 1);
  });
});

describe('resolveCheckoutResumeOrderingNameGate', () => {
  it('allows cancel path without checking names', () => {
    const gate = resolveCheckoutResumeOrderingNameGate({
      willPreserveSplit: false,
      splitMode: 'even',
      persons: [{ name: '客人 1' }],
      result: [{ name: '客人 1', amount: 10 }],
    });
    assert.equal(gate.ok, true);
  });

  it('blocks unpaid by-item default names that still have shares', () => {
    const gate = resolveCheckoutResumeOrderingNameGate({
      willPreserveSplit: true,
      splitMode: 'by_item',
      persons: [
        {
          name: '客人 1',
          item_shares: [{ key: 'cola', qty_num: 1, qty_den: 1 }],
        },
      ],
      result: [{ name: '客人 1', amount: 2 }],
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.deepEqual(gate.names, ['客人 1']);
  });

  it('blocks unpaid default names even when shares were already pruned away', () => {
    // After prune, empty unpaid should not remain; if they do, still block.
    const gate = resolveCheckoutResumeOrderingNameGate({
      willPreserveSplit: true,
      splitMode: 'by_item',
      persons: [],
      result: [{ name: '客人 1', amount: 0 }],
    });
    assert.equal(gate.ok, false);
  });

  it('allows paid default names through', () => {
    const paid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const gate = resolveCheckoutResumeOrderingNameGate({
      willPreserveSplit: true,
      splitMode: 'by_item',
      persons: [
        {
          name: '客人 1',
          party_id: paid,
          item_shares: [{ key: 'cola', qty_num: 1, qty_den: 1 }],
        },
      ],
      result: [{ name: '客人 1', amount: 2, paid: true, party_id: paid }],
    });
    assert.equal(gate.ok, true);
  });

  it('blocks unpaid even default names when preserving', () => {
    const gate = resolveCheckoutResumeOrderingNameGate({
      willPreserveSplit: true,
      splitMode: 'even',
      persons: [{ name: 'Guest 1' }, { name: 'Guest 2' }],
      result: [
        { name: 'Guest 1', amount: 10, paid: true },
        { name: 'Guest 2', amount: 10 },
      ],
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.deepEqual(gate.names, ['Guest 2']);
  });
});

describe('prepareStaffCheckoutResumeOrdering', () => {
  it('with editor flush: gates after flush so UI rename can pass', async () => {
    const request = {
      id: 'bs1',
      split_mode: 'by_item',
      session_id: 's1',
      table_id: 't1',
      persons: [
        { name: '客人 1', item_shares: [{ key: 'a', qty_num: 1, qty_den: 1 }] },
      ],
      result: [{ name: '客人 1', amount: 5 }],
    } as BillSplit;

    let flushed = false;
    const blocked = await prepareStaffCheckoutResumeOrdering({
      request,
      collectedPayments: [],
      flushDraft: async () => {
        flushed = true;
        return {
          persons: [
            {
              name: '客人 1',
              item_shares: [{ key: 'a', qty_num: 1, qty_den: 1 }],
            },
          ],
          result: [{ name: '客人 1', amount: 5 }],
        };
      },
      persistPrunedByItem: null,
    });
    assert.equal(flushed, true);
    assert.equal(blocked.ok, false);

    flushed = false;
    const renamed = await prepareStaffCheckoutResumeOrdering({
      request,
      collectedPayments: [],
      flushDraft: async () => {
        flushed = true;
        return {
          persons: [
            {
              name: 'Ana',
              item_shares: [{ key: 'a', qty_num: 1, qty_den: 1 }],
            },
          ],
          result: [{ name: 'Ana', amount: 5 }],
        };
      },
      persistPrunedByItem: null,
    });
    assert.equal(flushed, true);
    assert.equal(renamed.ok, true);
  });

  it('without editor flush: blocks on server roster before write', async () => {
    const request = {
      id: 'bs1',
      split_mode: 'by_item',
      session_id: 's1',
      table_id: 't1',
      persons: [
        { name: '客人 1', item_shares: [{ key: 'a', qty_num: 1, qty_den: 1 }] },
      ],
      result: [{ name: '客人 1', amount: 5 }],
    } as BillSplit;

    let wrote = false;
    const prepared = await prepareStaffCheckoutResumeOrdering({
      request,
      collectedPayments: [],
      flushDraft: null,
      persistPrunedByItem: async () => {
        wrote = true;
        return { persons: request.persons ?? [], result: request.result as never };
      },
    });
    assert.equal(prepared.ok, false);
    assert.equal(wrote, false);
  });

  it('passes after empty drop when remaining names are real', async () => {
    const request = {
      id: 'bs1',
      split_mode: 'by_item',
      session_id: 's1',
      table_id: 't1',
      persons: [
        { name: 'Ana', item_shares: [{ key: 'a', qty_num: 1, qty_den: 1 }] },
        { name: '客人 2', item_shares: [] },
      ],
      result: [
        { name: 'Ana', amount: 5 },
        { name: '客人 2', amount: 0 },
      ],
    } as BillSplit;

    const prepared = await prepareStaffCheckoutResumeOrdering({
      request,
      collectedPayments: [],
      flushDraft: async () => ({
        persons: [
          { name: 'Ana', item_shares: [{ key: 'a', qty_num: 1, qty_den: 1 }] },
        ],
        result: [{ name: 'Ana', amount: 5 }],
      }),
      persistPrunedByItem: null,
    });
    assert.equal(prepared.ok, true);
    if (prepared.ok) {
      assert.equal(prepared.persons.length, 1);
      assert.equal(prepared.persons[0]?.name, 'Ana');
    }
  });

  it('cancel_no_collections skips flush even when editor flush is registered', async () => {
    const request = {
      id: 'bs1',
      split_mode: 'whole_table',
      session_id: 's1',
      table_id: 't1',
      persons: [{ name: '__whole_table__' }],
      result: [{ name: '__whole_table__', amount: 87.75 }],
    } as BillSplit;

    let flushed = false;
    const prepared = await prepareStaffCheckoutResumeOrdering({
      request,
      collectedPayments: [],
      flushDraft: async () => {
        flushed = true;
        return { persons: [], result: [] };
      },
      persistPrunedByItem: null,
    });
    assert.equal(flushed, false);
    assert.equal(prepared.ok, true);
  });
});
