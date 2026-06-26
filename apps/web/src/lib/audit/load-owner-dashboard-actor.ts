import { createClient } from '@/lib/supabase/server';
import { ownerAuditActor, resolveOwnerOperatorName } from '@/lib/audit';
import type { AuditActor } from '@/lib/audit/types';

export async function loadOwnerDashboardAuditActor(restaurant: {
  id: string;
  name: string;
}): Promise<{ userId: string; actor: AuditActor } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    userId: user.id,
    actor: ownerAuditActor(user.id, resolveOwnerOperatorName(restaurant.name, user.email)),
  };
}
