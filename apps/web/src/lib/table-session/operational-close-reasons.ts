/**
 * closed_reason values that mean operational / force / nightly close.
 * Settled checkout uses owner_closed | frontdesk_closed | cashier_closed instead —
 * do not reuse those for force close, or revenue cannot tell them apart.
 */
export const OPERATIONAL_CLOSE_REASONS = [
  'waiter_closed',
  'owner_forced',
  'frontdesk_forced',
  'cashier_forced',
  'auto_nightly',
] as const;

export type OperationalCloseReason = (typeof OPERATIONAL_CLOSE_REASONS)[number];

export type SettledCloseActorReason = 'owner_closed' | 'frontdesk_closed' | 'cashier_closed';

export function isOperationalCloseReason(
  reason: string | null | undefined,
): reason is OperationalCloseReason {
  return (
    typeof reason === 'string' &&
    (OPERATIONAL_CLOSE_REASONS as readonly string[]).includes(reason)
  );
}

/** Map dashboard actor settled-style reason → force-close reason for manual close. */
export function settledActorReasonToForced(
  reason: SettledCloseActorReason,
): Exclude<OperationalCloseReason, 'waiter_closed' | 'auto_nightly'> {
  switch (reason) {
    case 'owner_closed':
      return 'owner_forced';
    case 'frontdesk_closed':
      return 'frontdesk_forced';
    case 'cashier_closed':
      return 'cashier_forced';
  }
}
