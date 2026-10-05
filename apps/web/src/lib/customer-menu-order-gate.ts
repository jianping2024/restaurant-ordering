import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import { guestOrderingEnabled } from '@/lib/guest-table-ordering';
import type { Language, SessionStatus, TableSession } from '@/types';

export type GuestOrderGateResult = {
  canPlace: boolean;
  sessionStatus: SessionStatus | null;
  /** Individual checkout: this phone has a called, unpaid ticket (table itself stays orderable). */
  individualHold?: boolean;
};

/** Sole merge of the per-phone individual-checkout hold into a table-level gate result. */
export function withIndividualHold(
  gate: GuestOrderGateResult,
  hold: boolean,
): GuestOrderGateResult {
  return hold ? { ...gate, canPlace: false, individualHold: true } : gate;
}

export function guestOrderGateFromSessionContext(
  context: CustomerSessionContext | null,
): GuestOrderGateResult {
  const session = (context?.active_session as TableSession | null) ?? null;
  return {
    canPlace: guestOrderingEnabled(session),
    sessionStatus: session?.status ?? null,
  };
}

export function guestOrderingActionHint(
  lang: Language,
  sessionStatus: SessionStatus | null,
  individualHold = false,
): string {
  const messages = MENU_PAGE_MESSAGES[lang];
  if (individualHold) return messages.individualCalledHint;
  if (sessionStatus === 'billing') return messages.billDisabledHint;
  return messages.buffetRequired;
}

/** Sole list-page banner copy for the guest order gate (not the toast action hint). */
export function guestOrderingBannerHint(
  lang: Language,
  sessionStatus: SessionStatus | null,
  individualHold = false,
): string {
  const messages = MENU_PAGE_MESSAGES[lang];
  if (individualHold) return messages.individualCalledHint;
  if (sessionStatus === 'billing') return messages.billDisabledHint;
  return messages.waitingForBuffet;
}

/**
 * Menu ordering gate: use cached state when already allowed; otherwise caller
 * should refresh session context and re-run guestOrderGateFromSessionContext.
 */
export function guestOrderGateFromCachedState(
  isDemo: boolean,
  activeSession: Pick<TableSession, 'status'> | null,
): GuestOrderGateResult | null {
  if (isDemo) {
    return { canPlace: true, sessionStatus: activeSession?.status ?? null };
  }
  if (guestOrderingEnabled(activeSession)) {
    return { canPlace: true, sessionStatus: activeSession?.status ?? 'open' };
  }
  return null;
}
