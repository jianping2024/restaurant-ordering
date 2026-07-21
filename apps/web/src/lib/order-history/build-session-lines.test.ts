import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOrderHistorySessionLines,
  isCloseSnapshotConsumptionItem,
} from '@/lib/order-history/build-session-lines';
import type { Order } from '@/types';

describe('isCloseSnapshotConsumptionItem', () => {
  it('excludes items voided long before session close', () => {
    const closedAt = '2026-07-05T12:00:00.000Z';
    assert.equal(
      isCloseSnapshotConsumptionItem(
        { item_status: 'voided', voided_at: '2026-07-05T10:00:00.000Z' },
        closedAt,
      ),
      false,
    );
  });

  it('includes items voided at close batch time', () => {
    const closedAt = '2026-07-05T12:00:00.000Z';
    assert.equal(
      isCloseSnapshotConsumptionItem(
        { item_status: 'voided', voided_at: '2026-07-05T12:00:00.500Z' },
        closedAt,
      ),
      true,
    );
  });

  it('includes active items for paid sessions', () => {
    assert.equal(
      isCloseSnapshotConsumptionItem({ item_status: 'done' }, '2026-07-05T12:00:00.000Z'),
      true,
    );
  });
});

describe('buildOrderHistorySessionLines', () => {
  const closedAt = '2026-07-05T12:00:00.000Z';
  const orders = [
    {
      id: 'o1',
      items: [
        {
          id: 'd1',
          name: 'Water',
          name_pt: 'Agua',
          qty: 2,
          price: 2.5,
          emoji: '💧',
          item_status: 'voided',
          voided_at: '2026-07-05T10:00:00.000Z',
        },
        {
          id: 'd2',
          name: 'Cola',
          name_pt: 'Cola',
          qty: 1,
          price: 3,
          emoji: '🥤',
          item_status: 'voided',
          voided_at: '2026-07-05T12:00:00.200Z',
        },
      ],
    },
  ] as Order[];

  it('uses billable lines for fully paid sessions', () => {
    const paidOrders = [
      {
        id: 'o1',
        items: [
          {
            id: 'd2',
            name: 'Cola',
            name_pt: 'Cola',
            qty: 1,
            price: 3,
            emoji: '🥤',
            item_status: 'done',
          },
        ],
      },
    ] as Order[];

    const lines = buildOrderHistorySessionLines(paidOrders, closedAt, true);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].label.includes('Cola'), true);
  });

  it('omits mid-meal voids for operational close snapshot', () => {
    const lines = buildOrderHistorySessionLines(orders, closedAt, false);
    assert.equal(lines.length, 1);
    assert.match(lines[0].label, /Cola/);
  });
});
