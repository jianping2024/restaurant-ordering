import { sessionDateKeyFromIso } from '@/lib/lisbon-calendar';

/**
 * Sole Lisbon YYYY-MM-DD for closed-session revenue / guests / table count.
 * Business day = when the table was opened (`opened_at`), not when it closed.
 */
export function sessionRevenueDateKey(session: { opened_at: string }): string {
  return sessionDateKeyFromIso(session.opened_at);
}
