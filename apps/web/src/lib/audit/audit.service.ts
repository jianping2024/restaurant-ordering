import type { SupabaseClient } from '@supabase/supabase-js';
import { insertAbnormalOperationRow } from '@/lib/audit/abnormal-operation.repository';
import { insertOperationLog } from '@/lib/audit/operation-log.repository';
import { getAuditEventDefinition } from '@/lib/audit/registry';
import { auditOperatorRole } from '@/lib/audit/resolve-actor';
import type {
  AuditEventKey,
  RecordAuditInput,
  RecordAuditResult,
} from '@/lib/audit/types';

export async function recordAudit<TContext>(
  admin: SupabaseClient,
  eventKey: AuditEventKey,
  input: RecordAuditInput<TContext>,
): Promise<RecordAuditResult> {
  const warnings: string[] = [];
  const definition = getAuditEventDefinition(eventKey);
  if (!definition) {
    warnings.push(`unknown_audit_event:${eventKey}`);
    console.error('[audit] unknown event', { eventKey, restaurantId: input.restaurantId });
    return { warnings };
  }

  let payload;
  try {
    payload = definition.build(input.context);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'build_failed';
    warnings.push(message);
    console.error('[audit] build failed', { eventKey, restaurantId: input.restaurantId, message });
    return { warnings };
  }

  if (definition.createsAbnormal && (!payload.abnormalType || !payload.riskLevel)) {
    warnings.push('missing_abnormal_metadata');
    console.error('[audit] missing abnormal metadata', { eventKey, restaurantId: input.restaurantId });
    return { warnings };
  }

  const operatorRole = auditOperatorRole(input.actor);
  const logResult = await insertOperationLog(admin, {
    restaurant_id: input.restaurantId,
    action_type: definition.actionType,
    entity_type: definition.entityType,
    entity_id: payload.entityId,
    operator_id: input.actor.userId,
    operator_name: input.actor.displayName,
    operator_role: operatorRole,
    before_data: payload.beforeData,
    after_data: payload.afterData,
    reason: input.reason,
    reason_detail: input.reasonDetail ?? null,
    ip_address: input.meta?.ipAddress ?? null,
    device_info: input.meta?.deviceInfo ?? null,
  });

  let operationLogId: string | undefined;
  if (!logResult.ok) {
    warnings.push(`operation_log_insert_failed:${logResult.message}`);
    console.error('[audit] operation_log insert failed', {
      eventKey,
      restaurantId: input.restaurantId,
      message: logResult.message,
    });
  } else {
    operationLogId = logResult.id;
  }

  if (!definition.createsAbnormal) {
    return { operationLogId, warnings };
  }

  const abnormalResult = await insertAbnormalOperationRow(admin, {
    restaurant_id: input.restaurantId,
    type: payload.abnormalType as NonNullable<typeof payload.abnormalType>,
    risk_level: payload.riskLevel as NonNullable<typeof payload.riskLevel>,
    order_id: payload.orderId ?? null,
    session_id: payload.sessionId ?? null,
    table_id: payload.tableId ?? null,
    table_name: payload.tableName ?? null,
    operator_id: input.actor.userId,
    operator_name: input.actor.displayName,
    operator_role: operatorRole,
    amount_impact: payload.amountImpact,
    reason: input.reason,
    reason_detail: input.reasonDetail ?? null,
    before_data: payload.beforeData,
    after_data: payload.afterData,
    source_action_id: operationLogId ?? null,
  });

  if (!abnormalResult.ok) {
    warnings.push(`abnormal_operation_insert_failed:${abnormalResult.message}`);
    console.error('[audit] abnormal_operations insert failed', {
      eventKey,
      restaurantId: input.restaurantId,
      message: abnormalResult.message,
    });
    return { operationLogId, warnings };
  }

  return {
    operationLogId,
    abnormalOperationId: abnormalResult.id,
    warnings,
  };
}
