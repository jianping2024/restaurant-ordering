import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUDIT_EVENT, isOperationLogActionType } from '@/lib/audit/types';
import { parseOperationLogsListQuery } from '@/lib/operation-logs/parse-list-query';
import { formatOperationLogDetail, operationLogTableLabel } from '@/lib/operation-logs/detail-text';
import {
  OPERATION_LOGS_Q_MAX_LEN,
  OPERATION_LOG_Q_TABLE_JSON_PATH,
  escapeIlikePatternForOr,
  normalizeOperationLogsSearchQ,
  operationLogsSearchOrFilter,
} from '@/lib/operation-logs/search';
import type { OperationLogRow } from '@/lib/operation-logs/types';

describe('operation logs filters', () => {
  it('parses action_type only when in OPERATION_LOG_ACTION_TYPES', () => {
    const ok = parseOperationLogsListQuery(
      new URLSearchParams('action_type=SESSION_OPENED&start_date=2026-08-01'),
      'rest-1',
    );
    assert.equal(ok.actionType, AUDIT_EVENT.SESSION_OPENED);

    const bad = parseOperationLogsListQuery(
      new URLSearchParams('action_type=ITEM_DELETED'),
      'rest-1',
    );
    assert.equal(bad.actionType, undefined);
    assert.equal(isOperationLogActionType('ITEM_DELETED'), false);
  });

  it('parses and normalizes sole search q', () => {
    const withQ = parseOperationLogsListQuery(new URLSearchParams('q=%20A1%20'), 'rest-1');
    assert.equal(withQ.q, 'A1');

    const blank = parseOperationLogsListQuery(new URLSearchParams('q=%20%20'), 'rest-1');
    assert.equal(blank.q, undefined);

    assert.equal(normalizeOperationLogsSearchQ(null), undefined);
    assert.equal(normalizeOperationLogsSearchQ('  x  '), 'x');
    assert.equal(
      normalizeOperationLogsSearchQ('a'.repeat(OPERATION_LOGS_Q_MAX_LEN + 10))?.length,
      OPERATION_LOGS_Q_MAX_LEN,
    );
  });

  it('builds one or-filter for operator_name and after_data.tableName only', () => {
    const filter = operationLogsSearchOrFilter('A1');
    assert.equal(
      filter,
      `operator_name.ilike.%A1%,${OPERATION_LOG_Q_TABLE_JSON_PATH}.ilike.%A1%`,
    );
    assert.equal(escapeIlikePatternForOr('a%b_c,d"e'), 'a\\%b\\_cde');
  });
});

describe('formatOperationLogDetail', () => {
  it('formats transfer table arrow and open headcount', () => {
    const transfer: OperationLogRow = {
      id: '1',
      restaurant_id: 'r',
      action_type: AUDIT_EVENT.TABLE_TRANSFERRED,
      entity_type: 'table_session',
      entity_id: 's',
      operator_id: 'u',
      operator_name: 'A',
      operator_role: 'frontdesk',
      before_data: { fromTableName: 'A1' },
      after_data: { toTableName: 'B2', sessionId: 's' },
      reason: null,
      reason_detail: null,
      created_at: new Date().toISOString(),
    };
    assert.equal(operationLogTableLabel(transfer), 'A1→B2');

    const open: OperationLogRow = {
      ...transfer,
      action_type: AUDIT_EVENT.SESSION_OPENED,
      before_data: {},
      after_data: { tableName: 'A1', adultCount: 2, childCount: 1 },
    };
    assert.match(formatOperationLogDetail('zh', open), /2/);
  });

  it('formats guest count, party, append, and decrement details', () => {
    const base: OperationLogRow = {
      id: '1',
      restaurant_id: 'r',
      action_type: AUDIT_EVENT.GUEST_COUNT_CHANGED,
      entity_type: 'table_session',
      entity_id: 's',
      operator_id: 'u',
      operator_name: 'A',
      operator_role: 'frontdesk',
      before_data: { adultCount: 1, childCount: 0 },
      after_data: { tableName: 'A1', adultCount: 2, childCount: 1 },
      reason: null,
      reason_detail: null,
      created_at: new Date().toISOString(),
    };
    assert.match(formatOperationLogDetail('zh', base), /1→2/);

    const party: OperationLogRow = {
      ...base,
      action_type: AUDIT_EVENT.TABLE_PARTY,
      entity_type: 'table_party',
      before_data: {},
      after_data: { partyName: 'g1', action: 'create' },
    };
    assert.equal(operationLogTableLabel(party), 'g1');
    assert.match(formatOperationLogDetail('zh', party), /创建/);

    const append: OperationLogRow = {
      ...base,
      action_type: AUDIT_EVENT.ORDER_APPENDED,
      entity_type: 'order',
      before_data: {},
      after_data: { tableName: 'A1', items: [{ itemName: 'Cola', qty: 2 }] },
    };
    assert.match(formatOperationLogDetail('zh', append), /Cola×2/);

    const dec: OperationLogRow = {
      ...base,
      action_type: AUDIT_EVENT.ITEM_QTY_DECREMENTED,
      entity_type: 'order',
      before_data: { itemName: 'Cola', qty: 2 },
      after_data: { tableName: 'A1', itemName: 'Cola', qty: 1 },
    };
    assert.match(formatOperationLogDetail('zh', dec), /2→1/);
  });
});
