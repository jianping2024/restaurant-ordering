import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTableGroupNameByTableId,
  buildWaiterBoardSections,
  isValidTableGroupName,
  sortTablesForGroupPrint,
  sortWaiterTableCards,
} from './restaurant-table-groups';
import type { RestaurantTableGroup, RestaurantTableGroupMember } from './restaurant-table-groups';

const tables = [
  { id: 't1', display_name: 'A-01', sort_order: 1 },
  { id: 't2', display_name: 'A-02', sort_order: 2 },
  { id: 't3', display_name: 'B-01', sort_order: 3 },
];

const groups: RestaurantTableGroup[] = [
  {
    id: 'g1',
    restaurant_id: 'r1',
    name: '大厅',
    remarks: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'g2',
    restaurant_id: 'r1',
    name: '包间',
    remarks: null,
    sort_order: 1,
    created_at: '2026-01-02T00:00:00.000Z',
  },
];

const members: RestaurantTableGroupMember[] = [
  { group_id: 'g1', table_id: 't1', restaurant_id: 'r1' },
  { group_id: 'g1', table_id: 't2', restaurant_id: 'r1' },
  { group_id: 'g2', table_id: 't3', restaurant_id: 'r1' },
];

describe('isValidTableGroupName', () => {
  it('rejects reserved labels', () => {
    assert.equal(isValidTableGroupName('其他桌位'), false);
    assert.equal(isValidTableGroupName('大厅'), true);
  });
});

describe('buildTableGroupNameByTableId', () => {
  it('maps table ids to group names', () => {
    assert.deepEqual(buildTableGroupNameByTableId(groups, members), {
      t1: '大厅',
      t2: '大厅',
      t3: '包间',
    });
  });
});

describe('buildWaiterBoardSections', () => {
  it('orders groups and adds ungrouped section', () => {
    const extraTables = [...tables, { id: 't4', display_name: 'C-01', sort_order: 4 }];
    const sections = buildWaiterBoardSections(groups, members, extraTables, '其他桌位');
    assert.equal(sections.length, 3);
    assert.equal(sections[0].title, '大厅');
    assert.deepEqual(sections[0].tableIds, ['t1', 't2']);
    assert.equal(sections[2].id, '__ungrouped__');
    assert.deepEqual(sections[2].tableIds, ['t4']);
  });

  it('skips empty groups on waiter board', () => {
    const emptyGroup: RestaurantTableGroup = {
      id: 'g-empty',
      restaurant_id: 'r1',
      name: '空组',
      remarks: null,
      sort_order: 2,
      created_at: '2026-01-03T00:00:00.000Z',
    };
    const sections = buildWaiterBoardSections(
      [...groups, emptyGroup],
      members,
      tables,
      '其他桌位',
    );
    assert.equal(sections.some((s) => s.id === 'g-empty'), false);
  });
});

describe('sortWaiterTableCards', () => {
  const t1 = '550e8400-e29b-41d4-a716-446655440001';
  const t2 = '550e8400-e29b-41d4-a716-446655440002';
  const uuidTables = [
    { id: t1, display_name: 'A-01', sort_order: 1 },
    { id: t2, display_name: 'A-02', sort_order: 2 },
  ];

  it('prioritizes checkout pending within a section', () => {
    const cards = [
      { tableId: t1, displayName: 'A-01', orderLines: [], hasBuffet: false },
      { tableId: t2, displayName: 'A-02', orderLines: [{ id: '1' }], hasBuffet: false },
    ];
    const sorted = sortWaiterTableCards(cards, uuidTables, [t1], {});
    assert.equal(sorted[0].tableId, t1);
  });
});

describe('sortTablesForGroupPrint', () => {
  it('orders tables by group sort then table sort', () => {
    const ordered = sortTablesForGroupPrint(tables, groups, members);
    assert.deepEqual(
      ordered.map((t) => t.id),
      ['t1', 't2', 't3'],
    );
  });
});
