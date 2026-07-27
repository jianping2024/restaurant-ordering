'use client';

import Link from 'next/link';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import { findOrderHistoryEntryBySessionId } from '@/lib/order-history/find-order-history-entry';
import { waiterTableHref } from '@/lib/staff-routes';
import type { getMessages } from '@/lib/i18n/messages';

type OrderHistoryI18n = ReturnType<typeof getMessages>['orderHistory'];

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

  const targetEntry = findOrderHistoryEntryBySessionId(entries, ctx.targetSessionId);
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

  const navigable = sources.filter((source) =>
    findOrderHistoryEntryBySessionId(entries, source.sourceSessionId),
  );
  if (navigable.length === 0) return null;

  return (
    <div className="rounded-lg border border-brand-border/60 bg-brand-bg/40 px-3 py-2.5 space-y-2">
      <p className="text-sm font-medium text-brand-text">{i18n.mergeSourcesNavTitle}</p>
      <ul className="space-y-1.5">
        {navigable.map((source) => {
          const sourceEntry = findOrderHistoryEntryBySessionId(entries, source.sourceSessionId);
          if (!sourceEntry) return null;
          return (
            <li key={source.sourceSessionId}>
              <button
                type="button"
                className="text-[13px] text-brand-gold hover:underline text-left"
                onClick={() => onSelectEntry(sourceEntry)}
              >
                {i18n.viewSourceSession.replace('{table}', source.sourceDisplayName)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
