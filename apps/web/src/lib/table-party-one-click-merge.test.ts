import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPartyOneClickMergePlan } from './table-party-one-click-merge';
import type { WaiterTableBoardState } from './waiter-board-session';

const T1 = '00000000-0000-4000-8000-000000000001';
const T2 = '00000000-0000-4000-8000-000000000002';
const T3 = '00000000-0000-4000-8000-000000000003';
const T4 = '00000000-0000-4000-8000-000000000004';

const names: Record<string, string> = {
  [T1]: 'A1',
  [T2]: 'A2',
  [T3]: 'A3',
  [T4]: 'A4',
};

function plan(
  order: string[],
  states: Record<string, WaiterTableBoardState>,
) {
  return buildPartyOneClickMergePlan(
    order,
    (id) => states[id] ?? 'idle',
    (id) => names[id] ?? id,
  );
}

describe('buildPartyOneClickMergePlan', () => {
  it('returns not_needed when fewer than two dining tables', () => {
    assert.equal(
      plan([T1, T2, T3], { [T1]: 'dining', [T2]: 'checkout', [T3]: 'idle' }).kind,
      'not_needed',
    );
    assert.equal(plan([T1], { [T1]: 'dining' }).kind, 'not_needed');
    assert.equal(
      plan([T1, T2], { [T1]: 'checkout', [T2]: 'idle' }).kind,
      'not_needed',
    );
  });

  it('picks first dining as target and skips checkout/idle', () => {
    const result = plan([T1, T2, T3, T4], {
      [T1]: 'checkout',
      [T2]: 'dining',
      [T3]: 'idle',
      [T4]: 'dining',
    });
    assert.equal(result.kind, 'ready');
    if (result.kind !== 'ready') return;
    assert.equal(result.targetTableId, T2);
    assert.equal(result.targetDisplayName, 'A2');
    assert.deepEqual(result.sourceTableIds, [T4]);
  });

  it('uses display order among dining tables', () => {
    const result = plan([T3, T1, T2], {
      [T1]: 'dining',
      [T2]: 'dining',
      [T3]: 'dining',
    });
    assert.equal(result.kind, 'ready');
    if (result.kind !== 'ready') return;
    assert.equal(result.targetTableId, T3);
    assert.deepEqual(result.sourceTableIds, [T1, T2]);
  });
});
