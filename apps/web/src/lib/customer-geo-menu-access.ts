import type { CustomerGeoOrderFailure } from '@/lib/customer-geo-order';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import type { Language } from '@/types';

/** Sole guest-facing line for a geo access / submit failure reason. */
export function messageForCustomerGeoFailure(
  lang: Language,
  reason: CustomerGeoOrderFailure,
): string {
  const t = MENU_PAGE_MESSAGES[lang];
  if (reason === 'too_far') return t.locationTooFar;
  if (reason === 'permission_denied') return t.locationPermissionDenied;
  if (reason === 'not_supported') return t.locationNotSupported;
  return t.locationCheckFailed;
}
