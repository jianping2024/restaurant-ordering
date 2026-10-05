/**
 * Individual checkout: realtime signal rows → merged call notice for the phone.
 * Pure helpers; the host component owns I/O. Spec: docs/guest-individual-checkout.zh.md.
 *
 * Sole notice payload is the signal row itself (name + claimed lines with amounts).
 * Pages must not resolve dish names from local catalogs for this modal.
 */
import { formatRational, normalizeRational } from '@/lib/rational-qty';
import type { Language } from '@/types';

/** Claimed line stamped at call time (sole notice dish representation). */
export type IndividualCheckoutSignalItem = {
  key: string;
  qty_num: number;
  qty_den: number;
  /** Line obligation for this ticket share (same cents path as collect). */
  amount: number;
  name_pt: string;
  name_en: string;
  name_zh: string;
};

export type IndividualCheckoutSignal = {
  id: string;
  kind: 'call' | 'silent';
  reason: 'call' | 'unlock' | 'update';
  ticket_key: string | null;
  name: string | null;
  items: IndividualCheckoutSignalItem[];
  created_at: string;
};

/** One person block in the call-notice modal (keyed by ticket, not display name). */
export type IndividualCallNoticePerson = {
  ticketKey: string;
  name: string;
  items: Array<{
    key: string;
    label: string;
    qtyLabel: string;
    amount: number;
  }>;
  /** Sum of line amounts (ticket obligation at call). */
  amount: number;
};

/** A call older than this is catch-up noise (phone was in the background): refresh, no modal. */
const INDIVIDUAL_CALL_NOTICE_MAX_AGE_MS = 120_000;

function asFiniteNumber(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function asTrimmedString(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Normalize one signal `items[]` entry (rich stamp or legacy key+qty only). */
export function normalizeIndividualCheckoutSignalItem(
  raw: unknown,
): IndividualCheckoutSignalItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const key = asTrimmedString(row.key);
  const qty_num = asFiniteNumber(row.qty_num);
  const qty_den = asFiniteNumber(row.qty_den);
  if (!key || qty_num == null || qty_den == null || !(qty_num > 0) || !(qty_den > 0)) {
    return null;
  }
  const amountRaw = asFiniteNumber(row.amount);
  return {
    key,
    qty_num,
    qty_den,
    amount: amountRaw != null && amountRaw >= 0 ? Math.round(amountRaw * 100) / 100 : 0,
    name_pt: asTrimmedString(row.name_pt) || asTrimmedString(row.name),
    name_en: asTrimmedString(row.name_en),
    name_zh: asTrimmedString(row.name_zh),
  };
}

export function normalizeIndividualCheckoutSignalItems(
  raw: unknown,
): IndividualCheckoutSignalItem[] {
  if (!Array.isArray(raw)) return [];
  const out: IndividualCheckoutSignalItem[] = [];
  for (const entry of raw) {
    const item = normalizeIndividualCheckoutSignalItem(entry);
    if (item) out.push(item);
  }
  return out;
}

/** Localized dish label from the call-time name snapshot. */
export function resolveIndividualCallSignalItemName(
  item: Pick<IndividualCheckoutSignalItem, 'name_pt' | 'name_en' | 'name_zh'>,
  lang: Language,
): string {
  const pt = item.name_pt.trim();
  const en = item.name_en.trim();
  const zh = item.name_zh.trim();
  if (lang === 'zh') return zh || pt || en;
  if (lang === 'en') return en || pt || zh;
  return pt || en || zh;
}

export function formatIndividualCallNoticeEuro(amount: number): string {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return `€${safe.toFixed(2)}`;
}

/** Calls that deserve a modal: someone else's, recent, and not one this phone just made. */
export function pickIndividualCallNoticeSignals(params: {
  signals: ReadonlyArray<IndividualCheckoutSignal>;
  ignoreTicketKeys: ReadonlySet<string>;
  nowMs: number;
}): IndividualCheckoutSignal[] {
  return params.signals.filter((signal) => {
    if (signal.kind !== 'call') return false;
    if (signal.ticket_key && params.ignoreTicketKeys.has(signal.ticket_key)) return false;
    const createdMs = Date.parse(signal.created_at);
    if (!Number.isFinite(createdMs)) return false;
    return params.nowMs - createdMs <= INDIVIDUAL_CALL_NOTICE_MAX_AGE_MS;
  });
}

/** Map one call signal → one person block (ticket key identity). */
export function buildIndividualCallNoticePerson(
  signal: IndividualCheckoutSignal,
  lang: Language,
): IndividualCallNoticePerson | null {
  const ticketKey = (signal.ticket_key ?? '').trim();
  if (!ticketKey) return null;
  const name = (signal.name ?? '').trim() || ticketKey;
  const items = normalizeIndividualCheckoutSignalItems(signal.items)
    .map((item) => {
      const label = resolveIndividualCallSignalItemName(item, lang);
      if (!label) return null;
      const qty = normalizeRational({ num: item.qty_num, den: item.qty_den });
      return {
        key: item.key,
        label,
        qtyLabel: `×${formatRational(qty)}`,
        amount: item.amount,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
  const amount =
    items.length > 0
      ? Math.round(items.reduce((sum, row) => sum + row.amount, 0) * 100) / 100
      : 0;
  return { ticketKey, name, items, amount };
}

/**
 * Merge call signals into the open modal roster: append/replace by ticket_key
 * (same ticket re-call updates; new tickets append; never merge two tickets by name).
 */
export function mergeIndividualCallNoticePeople(params: {
  existing: ReadonlyArray<IndividualCallNoticePerson>;
  signals: ReadonlyArray<IndividualCheckoutSignal>;
  lang: Language;
}): IndividualCallNoticePerson[] {
  const byKey = new Map<string, IndividualCallNoticePerson>();
  for (const person of params.existing) {
    byKey.set(person.ticketKey, person);
  }
  for (const signal of params.signals) {
    const person = buildIndividualCallNoticePerson(signal, params.lang);
    if (!person) continue;
    byKey.set(person.ticketKey, person);
  }
  return Array.from(byKey.values());
}
