import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  pickableBuffetOptions,
  withOpenableMinGuestCount,
} from '@/components/waiter/useWaiterOpenableBuffetIds';
import type { Buffet } from '@/types';

function buffet(id: string, overrides: Partial<Buffet> = {}): Buffet {
  return {
    id,
    restaurant_id: 'r1',
    name: id,
    is_active: true,
    description: null,
    vat_rate: 13,
    min_guest_count: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('withOpenableMinGuestCount', () => {
  it('takes the minimum from the snapshot, not the page list', () => {
    const [b] = withOpenableMinGuestCount([buffet('a', { min_guest_count: 5 })], { a: 2 });
    assert.equal(b.min_guest_count, 2);
  });

  it('missing from the snapshot → 0', () => {
    const [b] = withOpenableMinGuestCount([buffet('a', { min_guest_count: 5 })], {});
    assert.equal(b.min_guest_count, 0);
  });
});

describe('pickableBuffetOptions', () => {
  const list = [buffet('a'), buffet('b'), buffet('c', { is_active: false })];

  it('keeps openable active buffets and the current package, with snapshot minimums', () => {
    const options = pickableBuffetOptions(list, ['a'], 'c', { a: 3, c: 1 });
    assert.deepEqual(
      options.map((b) => [b.id, b.min_guest_count]),
      [
        ['a', 3],
        ['c', 1],
      ],
    );
  });

  it('null openable list → only the current package', () => {
    const options = pickableBuffetOptions(list, null, 'b', {});
    assert.deepEqual(options.map((b) => b.id), ['b']);
  });
});
