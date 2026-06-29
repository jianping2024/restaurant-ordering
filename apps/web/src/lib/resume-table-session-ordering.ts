import type { SupabaseClient } from '@supabase/supabase-js';
import { httpStatusForResumeOrderingRpcCode } from '@/lib/checkout-session-payments';

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
      status: httpStatusForResumeOrderingRpcCode(code),
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
