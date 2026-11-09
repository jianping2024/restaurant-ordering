import type { SupabaseClient } from '@supabase/supabase-js';
import { evenSplitEditLockFailure } from '@/lib/checkout-active-bill-split';
import { checkoutErrorStatus } from '@/lib/checkout-error-codes';
import { findActiveTableSession } from '@/lib/table-session-open';

export type ResumeOrderingResult =
  | { ok: true; session_id: string; table_id: string }
  | { ok: false; status: number; code: string; message?: string };

type ResumeRpcPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
  session_id?: string;
  table_id?: string;
};

export async function resumeTableSessionOrdering(params: {
  admin: SupabaseClient;
  restaurantId: string;
  tableId: string;
}): Promise<ResumeOrderingResult> {
  const { admin, restaurantId, tableId } = params;

  // Even split with a collection is frozen — new orders go to a new table.
  const session = await findActiveTableSession(admin, restaurantId, tableId).catch(() => null);
  if (session) {
    const locked = await evenSplitEditLockFailure({ admin, restaurantId, sessionId: session.id });
    if (locked) return { ok: false, status: locked.status, code: locked.error };
  }

  const { data, error } = await admin.rpc('resume_table_session_ordering', {
    p_restaurant_id: restaurantId,
    p_table_id: tableId,
  });

  if (error) {
    return {
      ok: false,
      status: 500,
      code: 'resume_failed',
      message: error.message,
    };
  }

  const payload = data as ResumeRpcPayload | null;
  if (!payload?.ok) {
    const code = payload?.code ?? 'resume_failed';
    return {
      ok: false,
      status: checkoutErrorStatus(code),
      code,
      message: payload?.message,
    };
  }

  return {
    ok: true,
    session_id: payload.session_id ?? '',
    table_id: payload.table_id ?? tableId,
  };
}
