import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUDIT_EVENT, isOperationLogActionType } from '@/lib/audit/types';
import { parseOperationLogsListQuery } from '@/lib/operation-logs/parse-list-query';
import { formatOperationLogDetail, operationLogTableLabel } from '@/lib/operation-logs/detail-text';
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
});
