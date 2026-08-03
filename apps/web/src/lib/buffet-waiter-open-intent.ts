/** Sole open vs save-headcount discriminant for POST …/staff/waiter/buffet. */
export type BuffetWaiterOpenIntent = 'open' | 'save';

/** Stale idle open: table already has an active session — do not mutate headcount. */
export const BUFFET_OPEN_ALREADY_OPEN = 'already_open';

export function parseBuffetWaiterOpenIntent(raw: unknown): BuffetWaiterOpenIntent | null {
  if (raw === 'open' || raw === 'save') return raw;
  return null;
}

/** Derive the sole POST intent from whether the client already has an open session. */
export function buffetWaiterOpenIntentFromSession(
  hasOpenSession: boolean,
): BuffetWaiterOpenIntent {
  return hasOpenSession ? 'save' : 'open';
}
