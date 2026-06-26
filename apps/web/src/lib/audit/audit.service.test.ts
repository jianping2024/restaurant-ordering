import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIT_EVENT } from '@/lib/audit/types';
import { recordAudit } from '@/lib/audit/audit.service';

function mockAdmin(insertResults: {
  operationLog?: { ok: boolean; id?: string; message?: string };
  abnormal?: { ok: boolean; id?: string; message?: string };
}): SupabaseClient {
  let operationLogCalls = 0;
  return {
    from(table: string) {
      if (table === 'operation_logs') {
        return {
          insert() {
            operationLogCalls += 1;
            return {
              select() {
                return {
                  async maybeSingle() {
                    if (insertResults.operationLog?.ok === false) {
                      return { data: null, error: { message: insertResults.operationLog.message } };
                    }
                    return {
                      data: { id: insertResults.operationLog?.id ?? 'log-1' },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'abnormal_operations') {
        return {
          insert() {
            return {
              select() {
                return {
                  async maybeSingle() {
                    if (insertResults.abnormal?.ok === false) {
                      return { data: null, error: { message: insertResults.abnormal.message } };
                    }
                    return {
                      data: { id: insertResults.abnormal?.id ?? 'abn-1' },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    get operationLogCalls() {
      return operationLogCalls;
    },
  } as unknown as SupabaseClient;
}

describe('recordAudit', () => {
  const actor = { userId: 'user-1', displayName: 'Front Desk', role: 'frontdesk' as const };
  const context = {
    sessionId: 'sess-1',
    tableId: 'table-1',
    tableName: 'A5',
    sessionStatusBefore: 'billing',
    payableAmount: 50,
    paidAmount: 10,
    gap: 40,
    hasUnpaidSplit: true,
  };

  it('inserts operation log and abnormal row for unpaid close', async () => {
    const admin = mockAdmin({});
    const result = await recordAudit(admin, AUDIT_EVENT.UNPAID_TABLE_CLOSED, {
      restaurantId: 'rest-1',
      actor,
      context,
      reason: 'left_unpaid',
      reasonDetail: null,
    });

    assert.equal(result.operationLogId, 'log-1');
    assert.equal(result.abnormalOperationId, 'abn-1');
    assert.deepEqual(result.warnings, []);
  });

  it('fail-open when operation log insert fails', async () => {
    const admin = mockAdmin({ operationLog: { ok: false, message: 'db down' } });
    const result = await recordAudit(admin, AUDIT_EVENT.UNPAID_TABLE_CLOSED, {
      restaurantId: 'rest-1',
      actor,
      context,
      reason: 'left_unpaid',
    });

    assert.equal(result.operationLogId, undefined);
    assert.ok(result.warnings.some((warning) => warning.includes('operation_log_insert_failed')));
  });

  it('fail-open when abnormal insert fails after log succeeds', async () => {
    const admin = mockAdmin({ abnormal: { ok: false, message: 'abn fail' } });
    const result = await recordAudit(admin, AUDIT_EVENT.UNPAID_TABLE_CLOSED, {
      restaurantId: 'rest-1',
      actor,
      context,
      reason: 'left_unpaid',
    });

    assert.equal(result.operationLogId, 'log-1');
    assert.equal(result.abnormalOperationId, undefined);
    assert.ok(result.warnings.some((warning) => warning.includes('abnormal_operation_insert_failed')));
  });

  it('inserts operation log and abnormal row for discount applied', async () => {
    const admin = mockAdmin({});
    const result = await recordAudit(admin, AUDIT_EVENT.DISCOUNT_APPLIED, {
      restaurantId: 'rest-1',
      actor,
      context: {
        billSplitId: 'split-1',
        sessionId: 'sess-1',
        tableId: 'table-1',
        tableName: 'B2',
        originalTotal: 80,
        discountRate: 10,
        discountAmount: 8,
        finalTotal: 72,
      },
      reason: 'owner_approved',
    });

    assert.equal(result.operationLogId, 'log-1');
    assert.equal(result.abnormalOperationId, 'abn-1');
  });
});
