import type { StaffAssistedFlow } from '@/lib/staff-routes';

export type CustomerOrderingAudience = 'guest' | 'staff-assisted';

export function customerOrderingAudience(
  staffAssisted?: StaffAssistedFlow | null,
): CustomerOrderingAudience {
  return staffAssisted ? 'staff-assisted' : 'guest';
}
