import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  checkoutQueueFocusKey,
  dashboardCheckoutFocusHref,
  dashboardCheckoutTableHref,
  hasCheckoutQueueFocus,
  parseCheckoutQueueFocus,
  resolveFocusedRequestId,
} from './checkout-queue-focus';

const tableId = '550e8400-e29b-41d4-a716-446655440001';
const requestId = '660e8400-e29b-41d4-a716-446655440002';

function row(overrides: Partial<BillSplit> & Pick<BillSplit, 'id' | 'table_id'>): BillSplit {
  return {
    restaurant_id: 'r1',
    session_id: 's1',
    display_name: '004',
    status: 'requested',
    split_mode: 'custom',
    persons: [],
    result: [],
    total_amount: 10,
    created_at: '2026-07-06T00:00:00Z',
    ...overrides,
  } as BillSplit;
}

describe('parseCheckoutQueueFocus', () => {
  it('returns null when params empty', () => {
    assert.equal(parseCheckoutQueueFocus({}), null);
  });

  it('parses table_id and request_id', () => {
    assert.deepEqual(parseCheckoutQueueFocus({ table_id: tableId, request_id: requestId }), {
      tableId,
      requestId,
    });
  });
});

describe('resolveFocusedRequestId', () => {
  const requests = [
    row({ id: requestId, table_id: tableId }),
    row({ id: 'other', table_id: '550e8400-e29b-41d4-a716-446655440099' }),
  ];

  it('prefers request_id', () => {
    assert.equal(
      resolveFocusedRequestId(requests, { requestId, tableId: 'wrong' }),
      requestId,
    );
  });

  it('falls back to table_id', () => {
    assert.equal(resolveFocusedRequestId(requests, { tableId }), requestId);
  });

  it('returns null when queue empty', () => {
    assert.equal(resolveFocusedRequestId([], { tableId }), null);
  });
});

describe('dashboardCheckoutFocusHref', () => {
  it('includes request_id when provided', () => {
    const href = dashboardCheckoutFocusHref({ tableId, requestId });
    assert.ok(href.includes(`table_id=${encodeURIComponent(tableId)}`));
    assert.ok(href.includes(`request_id=${encodeURIComponent(requestId)}`));
  });

  it('table-only href matches dashboardCheckoutTableHref', () => {
    assert.equal(dashboardCheckoutTableHref(tableId), dashboardCheckoutFocusHref({ tableId }));
  });
});

describe('hasCheckoutQueueFocus', () => {
  it('detects focus presence', () => {
    assert.equal(hasCheckoutQueueFocus(null), false);
    assert.equal(hasCheckoutQueueFocus({ tableId }), true);
    assert.equal(hasCheckoutQueueFocus({ requestId }), true);
  });
});

describe('checkoutQueueFocusKey', () => {
  it('stable key for reload dedupe', () => {
    assert.equal(
      checkoutQueueFocusKey({ tableId, requestId }),
      `${requestId}:${tableId}`,
    );
  });
});
