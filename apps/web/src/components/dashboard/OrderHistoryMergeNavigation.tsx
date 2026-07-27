'use client';

import Link from 'next/link';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import { waiterTableHref } from '@/lib/staff-routes';
import {
  formatMergeSourceLine,
  formatOrderHistoryInstant,
} from '@/lib/order-history/build-lifecycle-presentation';
import type { getMessages } from '@/lib/i18n/messages';

type OrderHistoryI18n = ReturnType<typeof getMessages>['orderHistory'];

function findEntryBySessionId(
  entries: OrderHistoryEntry[],
  sessionId: string,
): OrderHistoryEntry | undefined {
  return entries.find((row) => row.sessionId === sessionId);
}

export function OrderHistoryMergeTargetLink({
  entry,
  entries,
  restaurantSlug,
  i18n,
  onSelectEntry,
}: {
  entry: OrderHistoryEntry;
  entries: OrderHistoryEntry[];
  restaurantSlug: string;
  i18n: OrderHistoryI18n;
  onSelectEntry: (entry: OrderHistoryEntry) => void;
}) {
  const ctx = entry.mergeContext;
  if (!ctx?.targetSessionId) return null;

  if (ctx.targetStatus === 'open' || ctx.targetStatus === 'billing') {
    if (!ctx.targetTableId) return null;
    return (
      <Link
        href={waiterTableHref(restaurantSlug, ctx.targetTableId)}
        className="text-sm text-brand-gold hover:underline"
      >
        {i18n.viewActiveTargetTable}
      </Link>
    );
  }

  const targetEntry = findEntryBySessionId(entries, ctx.targetSessionId);
  if (!targetEntry) return null;

  return (
    <button
      type="button"
      className="text-sm text-brand-gold hover:underline"
      onClick={() => onSelectEntry(targetEntry)}
    >
      {i18n.viewTargetSession}
    </button>
  );
}

export function OrderHistoryMergeSourcesBlock({
  entry,
  entries,
  i18n,
  onSelectEntry,
}: {
  entry: OrderHistoryEntry;
  entries: OrderHistoryEntry[];
  i18n: OrderHistoryI18n;
  onSelectEntry: (entry: OrderHistoryEntry) => void;
}) {
  const sources = entry.mergeSources;
  if (!sources?.length) return null;

  return (
    <div className="rounded-lg border border-brand-border/60 bg-brand-bg/40 px-3 py-2.5 space-y-2">
      <p className="text-sm font-medium text-brand-text">{i18n.mergeSourcesTitle}</p>
      <ul className="space-y-1.5">
        {sources.map((source) => {
          const sourceEntry = findEntryBySessionId(entries, source.sourceSessionId);
          const line = formatMergeSourceLine(source, i18n, formatOrderHistoryInstant);
          return (
            <li key={source.sourceSessionId}>
              {sourceEntry ? (
                <button
                  type="button"
                  className="text-[13px] text-brand-gold hover:underline text-left"
                  onClick={() => onSelectEntry(sourceEntry)}
                >
                  {line}
                </button>
              ) : (
                <span className="text-[13px] text-brand-text-muted">{line}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
