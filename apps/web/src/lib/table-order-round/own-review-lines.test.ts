import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTableRoundReviewGroups } from './own-review-lines';
import type { TableOrderRoundLineRow } from './types';
import type { MenuItem } from '@/types';

const menuItems = [
  {
    id: 'm1',
    name_pt: 'Salmon',
    name_en: 'Salmon',
    name_zh: '三文鱼',
    emoji: '🍣',
  },
] as MenuItem[];

function line(partial: Partial<TableOrderRoundLineRow> & Pick<TableOrderRoundLineRow, 'id' | 'guest_client_id' | 'note' | 'qty'>): TableOrderRoundLineRow {
  return {
    round_id: 'r1',
    menu_item_id: 'm1',
    added_at: '2026-09-30T12:00:00.000Z',
    ...partial,
  };
}

describe('buildTableRoundReviewGroups', () => {
  it('puts own block first and omits ×N from labels', () => {
    const groups = buildTableRoundReviewGroups({
      lines: [
        line({ id: 'l2', guest_client_id: 'peer', note: '', qty: 2, added_at: '2026-09-30T11:00:00.000Z' }),
        line({ id: 'l1', guest_client_id: 'me', note: 'soft', qty: 3 }),
      ],
      guestClientId: 'me',
      menuItems,
      lang: 'zh',
      ownBlockLabel: '我',
    });
    assert.equal(groups[0]?.submittedTimeLabel, '我');
    assert.equal(groups[0]?.lines[0]?.editable, true);
    assert.equal(groups[0]?.lines[0]?.qty, 3);
    assert.equal(groups[0]?.lines[0]?.note, 'soft');
    assert.ok(!groups[0]?.lines[0]?.label.includes('×'));
    assert.equal(groups[1]?.lines[0]?.editable, false);
    assert.equal(groups[1]?.lines[0]?.qty, 2);
  });

  it('keeps same dish different notes as separate editable rows', () => {
    const groups = buildTableRoundReviewGroups({
      lines: [
        line({ id: 'a', guest_client_id: 'me', note: 'a', qty: 1 }),
        line({ id: 'b', guest_client_id: 'me', note: 'b', qty: 2 }),
      ],
      guestClientId: 'me',
      menuItems,
      lang: 'zh',
      ownBlockLabel: '我',
    });
    assert.equal(groups[0]?.lines.length, 2);
  });
});
