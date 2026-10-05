import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unlockableIndividualTicketKeys } from './staff-ticket-unlock';
import type { BillSplit } from '../../../types';

const PA = '11111111-1111-4111-8111-111111111111';
const PB = '22222222-2222-4222-8222-222222222222';
const PC = '33333333-3333-4333-8333-333333333333';

function split(partial: Partial<BillSplit>): BillSplit {
  return {
    id: 's1',
    restaurant_id: 'r1',
    table_id: 't1',
    display_name: 'A-12',
    order_ids: [],
    split_mode: 'by_item',
    persons: [],
    result: [],
    total_amount: 0,
    status: 'requested',
    created_at: '2026-10-05T12:00:00Z',
    ...partial,
  };
}

describe('unlockableIndividualTicketKeys', () => {
  it('is empty for plans without individual ticket state', () => {
    assert.equal(unlockableIndividualTicketKeys(split({}), []).size, 0);
  });

  it('keeps called, unpaid tickets and drops unlocked / paid / collected ones', () => {
    const keys = unlockableIndividualTicketKeys(
      split({
        result: [
          { name: 'A', party_id: PA, amount: 5 },
          { name: 'B', party_id: PB, amount: 6, paid: true },
          { name: 'C', party_id: PC, amount: 7 },
        ],
        individual_tickets: [
          { ticket_key: `p:${PA}`, name: 'A', state: 'called' },
          { ticket_key: `p:${PB}`, name: 'B', state: 'called' },
          { ticket_key: `p:${PC}`, name: 'C', state: 'unlocked' },
        ],
      }),
      [],
    );
    assert.deepEqual(Array.from(keys), [`p:${PA}`]);
  });
});
