import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import { guestOrderingEnabled } from '@/lib/guest-table-ordering';
import { buildBuffetBaseLine } from '@/lib/buffet-order';

const buffetLine = buildBuffetBaseLine({
  buffet: { id: 'buffet-a', name: 'Lunch' },
  adultCount: 2,
  childCount: 0,
  resolved: { adult_price: 20, child_price: 10, rule_id: 'r1', time_slot_id: 's1' },
});
assert.ok(buffetLine);

describe('guestOrderingEnabled', () => {
  it('is false without open session', () => {
    assert.equal(guestOrderingEnabled(null, []), false);
    assert.equal(guestOrderingEnabled({ status: 'billing' }, []), false);
  });

  it('is false on open session before buffet is posted', () => {
    assert.equal(guestOrderingEnabled({ status: 'open' }, []), false);
  });

  it('is true after active buffet_base exists', () => {
    const orders = [
      {
        id: 'o1',
        status: 'done',
        items: [buffetLine],
        created_at: '',
        updated_at: '',
        restaurant_id: 'r1',
        session_id: 's1',
        table_id: 't1',
        display_name: 'A1',
        total_amount: 40,
      } satisfies Order,
    ];
    assert.equal(guestOrderingEnabled({ status: 'open' }, orders), true);
  });
});
