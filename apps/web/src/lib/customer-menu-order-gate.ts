import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import { guestOrderingEnabled } from '@/lib/guest-table-ordering';
import type { Language, SessionStatus, TableSession } from '@/types';

export type GuestOrderGateResult = {
  canPlace: boolean;
  sessionStatus: SessionStatus | null;
};

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
): string {
  const messages = MENU_PAGE_MESSAGES[lang];
  if (sessionStatus === 'billing') return messages.billDisabledHint;
  return messages.buffetRequired;
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
