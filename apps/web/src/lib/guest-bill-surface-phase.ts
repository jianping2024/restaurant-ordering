/**
 * Sole guest bill UI phase (editing / awaiting payment / settled).
 * Menu append gates stay on {@link individualPhoneHoldsOrdering} — never use this phase for that.
 */
import type { BillSplit } from '@/types';

export type GuestBillSurfacePhase = 'editing' | 'awaiting_payment' | 'settled';

/**
 * Next bill surface after a sync (or local call latch).
 *
 * - This phone's unpaid called ticket → `awaiting_payment`
 * - Shared plan holds every phone ({@link guestSharedPlanHoldsAwaiting}) → same shell
 * - Local latch right after this phone called → `awaiting_payment` until sync confirms
 * - Split `paid`, or no live session → `settled`
 * - Otherwise (resume, unlock frees the pool, by-item ticket paid while table open) → `editing`
 *
 * No live session always settles — including phones still on the call-checkout editor
 * that never pressed 呼叫结账 (staff collected the last person and closed the table).
 */
export function resolveGuestBillSurfacePhase(params: {
  previousPhase: GuestBillSurfacePhase;
  /** This phone has a called unpaid by-item ticket. */
  phoneHoldsOrdering: boolean;
  /** Shared plan: every phone on awaiting/submitted (whole/even called, or by-item pool full). */
  sharedPlanHoldsAwaiting: boolean;
  /** Local latch right after this phone called, before server confirms. */
  localCalledLatch: boolean;
  /** Live open/billing session id; null when the table has no active session. */
  sessionId: string | null;
  splitStatus: BillSplit['status'] | null;
}): GuestBillSurfacePhase {
  const liveAwaiting =
    params.phoneHoldsOrdering ||
    params.sharedPlanHoldsAwaiting ||
    params.localCalledLatch;

  // Awaiting only while the table session is still live (latch alone after close → settled).
  if (liveAwaiting && params.sessionId) return 'awaiting_payment';

  if (params.splitStatus === 'paid') return 'settled';

  if (!params.sessionId) return 'settled';

  return 'editing';
}

/** Success / settled screens share the non-editing shell. */
export function guestBillSurfaceShowsSubmitted(
  phase: GuestBillSurfacePhase,
): boolean {
  return phase === 'awaiting_payment' || phase === 'settled';
}
