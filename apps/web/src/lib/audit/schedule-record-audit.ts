import type { SupabaseClient } from '@supabase/supabase-js';
import { recordAudit } from '@/lib/audit/audit.service';
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
