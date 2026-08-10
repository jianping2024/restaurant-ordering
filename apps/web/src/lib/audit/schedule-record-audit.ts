import type { SupabaseClient } from '@supabase/supabase-js';
import { recordAudit } from '@/lib/audit/audit.service';
import { loadStaffAuditActor } from '@/lib/audit/resolve-actor';
import type { AuditEventKey, RecordAuditInput } from '@/lib/audit/types';

/**
 * Sole non-blocking write path for staff operation logs.
 * Never awaits on the critical path — fail-open.
 */
export function scheduleRecordAudit<TContext>(
  admin: SupabaseClient,
  eventKey: AuditEventKey,
  input: RecordAuditInput<TContext>,
): void {
  void recordAudit(admin, eventKey, input)
    .then((result) => {
      if (result.warnings.length > 0) {
        console.error('[audit] schedule warnings', {
          eventKey,
          restaurantId: input.restaurantId,
          warnings: result.warnings,
        });
      }
    })
    .catch((err) => {
      console.error('[audit] schedule failed', {
        eventKey,
        restaurantId: input.restaurantId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
}

/** Resolve actor then write — still never awaited on the request critical path. */
export function scheduleStaffRecordAudit<TContext>(
  admin: SupabaseClient,
  eventKey: AuditEventKey,
  params: {
    restaurantId: string;
    userId: string;
    role: string;
    context: TContext;
    reason?: string | null;
    reasonDetail?: string | null;
  },
): void {
  void (async () => {
    try {
      const actor = await loadStaffAuditActor(admin, {
        restaurantId: params.restaurantId,
        userId: params.userId,
        role: params.role,
      });
      scheduleRecordAudit(admin, eventKey, {
        restaurantId: params.restaurantId,
        actor,
        context: params.context,
        reason: params.reason,
        reasonDetail: params.reasonDetail,
      });
    } catch (err) {
      console.error('[audit] schedule staff actor failed', {
        eventKey,
        restaurantId: params.restaurantId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}
