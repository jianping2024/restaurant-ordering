import type { Language } from '@/types';

export const GUEST_ORDERING_NOTICE_TITLE_MAX = 80;
export const GUEST_ORDERING_NOTICE_BODY_MAX = 2000;

export type GuestOrderingNoticeLocaleFields = {
  pt: string;
  en: string;
  zh: string;
};

export type GuestOrderingNotice = {
  enabled: boolean;
  title: GuestOrderingNoticeLocaleFields;
  body: GuestOrderingNoticeLocaleFields;
  updated_at: string | null;
};

export type GuestOrderingNoticeLocalized = {
  title: string;
  body: string;
  updatedAt: string;
};

export type GuestOrderingNoticeDraft = GuestOrderingNotice;

const EMPTY_LOCALE: GuestOrderingNoticeLocaleFields = { pt: '', en: '', zh: '' };

function sanitizePlainText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function parseLocaleFields(
  value: unknown,
  maxLength: number,
): GuestOrderingNoticeLocaleFields {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    pt: sanitizePlainText(row.pt, maxLength),
    en: sanitizePlainText(row.en, maxLength),
    zh: sanitizePlainText(row.zh, maxLength),
  };
}

export function emptyGuestOrderingNotice(): GuestOrderingNotice {
  return {
    enabled: false,
    title: { ...EMPTY_LOCALE },
    body: { ...EMPTY_LOCALE },
    updated_at: null,
  };
}

/** Normalize DB / API payload into the canonical notice shape. */
export function normalizeGuestOrderingNotice(value: unknown): GuestOrderingNotice {
  if (!value || typeof value !== 'object') return emptyGuestOrderingNotice();
  const row = value as Record<string, unknown>;
  const updatedAt =
    typeof row.updated_at === 'string' && row.updated_at.trim() ? row.updated_at.trim() : null;
  return {
    enabled: row.enabled === true,
    title: parseLocaleFields(row.title, GUEST_ORDERING_NOTICE_TITLE_MAX),
    body: parseLocaleFields(row.body, GUEST_ORDERING_NOTICE_BODY_MAX),
    updated_at: updatedAt,
  };
}

export function resolveGuestOrderingNoticeLocaleText(
  fields: GuestOrderingNoticeLocaleFields,
  lang: Language,
): string {
  if (lang === 'zh') return (fields.zh || fields.en || fields.pt).trim();
  if (lang === 'en') return (fields.en || fields.pt).trim();
  return fields.pt.trim();
}

/** Guest-visible notice for the active UI language; null when disabled or empty. */
export function resolveGuestOrderingNoticeForDisplay(
  notice: GuestOrderingNotice | null | undefined,
  lang: Language,
): GuestOrderingNoticeLocalized | null {
  const normalized = normalizeGuestOrderingNotice(notice);
  if (!normalized.enabled || !normalized.updated_at) return null;
  if (!normalized.title.pt.trim() || !normalized.body.pt.trim()) return null;

  const title = resolveGuestOrderingNoticeLocaleText(normalized.title, lang);
  const body = resolveGuestOrderingNoticeLocaleText(normalized.body, lang);
  if (!title || !body) return null;

  return {
    title,
    body,
    updatedAt: normalized.updated_at,
  };
}

export type GuestOrderingNoticeValidationError =
  | 'notice_pt_title_required'
  | 'notice_pt_body_required';

export function validateGuestOrderingNoticeDraft(
  draft: GuestOrderingNotice,
): GuestOrderingNoticeValidationError | null {
  if (!draft.enabled) return null;
  if (!draft.title.pt.trim()) return 'notice_pt_title_required';
  if (!draft.body.pt.trim()) return 'notice_pt_body_required';
  return null;
}

export function parseGuestOrderingNoticeDraft(body: Record<string, unknown>): GuestOrderingNotice {
  const normalized = normalizeGuestOrderingNotice(body);
  return {
    enabled: normalized.enabled,
    title: normalized.title,
    body: normalized.body,
    updated_at: normalized.updated_at,
  };
}

export function guestOrderingNoticeStorageKey(restaurantId: string): string {
  return `mesa-guest-notice-seen:${restaurantId}`;
}

export function readGuestOrderingNoticeSeenAt(restaurantId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(guestOrderingNoticeStorageKey(restaurantId));
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function markGuestOrderingNoticeSeen(restaurantId: string, updatedAt: string): void {
  if (typeof window === 'undefined' || !updatedAt.trim()) return;
  try {
    sessionStorage.setItem(guestOrderingNoticeStorageKey(restaurantId), updatedAt);
  } catch {
    // ignore quota / private mode
  }
}

export function guestOrderingNoticeHasUnreadUpdate(
  restaurantId: string,
  updatedAt: string,
): boolean {
  const seenAt = readGuestOrderingNoticeSeenAt(restaurantId);
  return seenAt !== updatedAt;
}
