import type { StaffRole } from '@/lib/staff-account';

/** Post-login / session paths by staff role (safe for server and client). */
export function staffRolePath(slug: string, role: StaffRole): string {
  if (role === 'kitchen') return `/${slug}/kitchen`;
  if (role === 'cashier') return '/dashboard/checkout';
  return `/${slug}/waiter`;
}
