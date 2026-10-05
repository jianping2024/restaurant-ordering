/**
 * Individual checkout: realtime signal rows → one merged call notice for the phone.
 * Pure helpers; the host component owns I/O. Spec: docs/guest-individual-checkout.zh.md.
 */
import { formatRational, normalizeRational } from '@/lib/rational-qty';

type IndividualCheckoutSignalItem = {
  key: string;
  qty_num: number;
  qty_den: number;
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

/** A call older than this is catch-up noise (phone was in the background): refresh, no modal. */
const INDIVIDUAL_CALL_NOTICE_MAX_AGE_MS = 120_000;

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

type IndividualCallNoticeLabels = {
  withItems: string;
  withoutItems: string;
};

function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

/** One line per call; several calls inside the debounce window merge into one multi-line modal. */
export function formatIndividualCallNotice(params: {
  signals: ReadonlyArray<IndividualCheckoutSignal>;
  /** Localized dish name for a line key; omit on pages that only know session orders loosely. */
  resolveLineName?: (lineKey: string) => string | null;
  labels: IndividualCallNoticeLabels;
}): string {
  const { signals, resolveLineName, labels } = params;
  return signals
    .map((signal) => {
      const name = (signal.name ?? '').trim();
      const parts: string[] = [];
      if (resolveLineName) {
        for (const item of signal.items) {
          const lineName = resolveLineName(item.key);
          if (!lineName || !(item.qty_num > 0) || !(item.qty_den > 0)) continue;
          parts.push(
            `${lineName} ×${formatRational(normalizeRational({ num: item.qty_num, den: item.qty_den }))}`,
          );
        }
      }
      return parts.length > 0
        ? fillTemplate(labels.withItems, { name, items: parts.join('、') })
        : fillTemplate(labels.withoutItems, { name });
    })
    .join('\n');
}
