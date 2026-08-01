import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTableGroupIdByTableId,
  buildTableGroupNameByTableId,
  buildWaiterBoardSections,
  isValidTableGroupName,
  sortTablesForGroupAssignPicker,
  sortTablesForGroupPrint,
  sortTableIdsByRestaurantTableOrder,
  listGroupMemberTablesInOrder,
  formatGroupMemberTablePreview,
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
  const t3 = '550e8400-e29b-41d4-a716-446655440003';
  const uuidTables = [
    { id: t1, display_name: 'A-01', sort_order: 1 },
    { id: t2, display_name: 'A-02', sort_order: 2 },
    { id: t3, display_name: 'A-03', sort_order: 3 },
  ];

  it('prioritizes checkout pending within a section', () => {
    const cards = [
      { tableId: t1, displayName: 'A-01' },
      { tableId: t2, displayName: 'A-02' },
    ];
    const sorted = sortWaiterTableCards(cards, uuidTables, [t2], {});
    assert.equal(sorted[0].tableId, t2);
    assert.equal(sorted[1].tableId, t1);
  });

  it('keeps restaurant table order when occupancy differs', () => {
    const cards = [
      { tableId: t3, displayName: 'A-03' },
      { tableId: t1, displayName: 'A-01' },
      { tableId: t2, displayName: 'A-02' },
    ];
    const sorted = sortWaiterTableCards(cards, uuidTables, [], {});
    assert.deepEqual(
      sorted.map((c) => c.tableId),
      [t1, t2, t3],
    );
  });
});

describe('sortTablesForGroupAssignPicker', () => {
  it('orders ungrouped, current group, then other groups', () => {
    const extra = { id: 't4', display_name: 'C-01', sort_order: 4 };
    const ordered = sortTablesForGroupAssignPicker(
      [...tables, extra],
      groups,
      members,
      'g1',
    );
    assert.equal(ordered[0].id, 't4');
    assert.ok(['t1', 't2'].includes(ordered[1].id));
    assert.equal(ordered[ordered.length - 1].id, 't3');
  });
});

describe('buildTableGroupIdByTableId', () => {
  it('maps table ids to group ids', () => {
    assert.deepEqual(buildTableGroupIdByTableId(members), {
      t1: 'g1',
      t2: 'g1',
      t3: 'g2',
    });
  });
});
describe('sortTableIdsByRestaurantTableOrder', () => {
  it('orders member ids by restaurant table sort_order', () => {
    const reversed = [
      { id: 't1', display_name: 'A-01', sort_order: 2 },
      { id: 't2', display_name: 'A-02', sort_order: 1 },
    ];
    assert.deepEqual(sortTableIdsByRestaurantTableOrder(['t1', 't2'], reversed), ['t2', 't1']);
  });
});

describe('listGroupMemberTablesInOrder', () => {
  it('returns full table rows in restaurant table sort_order', () => {
    const tables = [
      { id: 't1', display_name: 'A-01', sort_order: 2, seat_min: 2, seat_max: 4 },
      { id: 't2', display_name: 'A-02', sort_order: 1, seat_min: 2, seat_max: 4 },
    ];
    const ordered = listGroupMemberTablesInOrder(['t1', 't2'], tables);
    assert.deepEqual(
      ordered.map((row) => row.id),
      ['t2', 't1'],
    );
  });
});

describe('formatGroupMemberTablePreview', () => {
  it('shows first N chips and overflow count', () => {
    const manyTables = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i + 1}`,
      display_name: `A-${String(i + 1).padStart(2, '0')}`,
      sort_order: i + 1,
    }));
    const preview = formatGroupMemberTablePreview(
      manyTables.map((t) => t.id),
      manyTables,
      6,
    );
    assert.equal(preview.totalCount, 10);
    assert.equal(preview.chips.length, 6);
    assert.equal(preview.overflowCount, 4);
    assert.equal(preview.chips[0]?.display_name, 'A-01');
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
