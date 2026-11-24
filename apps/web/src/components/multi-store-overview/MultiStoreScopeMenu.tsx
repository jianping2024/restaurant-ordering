'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  overviewCities,
  rowMatchesSearch,
  type OverviewScope,
} from '@/components/multi-store-overview/multi-store-overview-table';
import type { MultiStoreOverviewMessages } from '@/lib/i18n/multi-store-overview-messages';
import type { MultiStoreOverviewRow } from '@/lib/multi-store-overview-types';

const CHIP = 'min-h-9 rounded-full border px-3 text-sm transition-colors';
const CHECK_ROW = 'flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-brand-border/40';

/** The sole「店铺范围」multi-select dropdown: 全部 / 按城市 / 自选 (searchable). */
export function MultiStoreScopeMenu({
  rows,
  scope,
  onChange,
  t,
  unknownCity,
}: {
  rows: readonly MultiStoreOverviewRow[];
  scope: OverviewScope;
  onChange: (scope: OverviewScope) => void;
  t: MultiStoreOverviewMessages;
  unknownCity: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const cities = useMemo(() => overviewCities(rows), [rows]);
  const cityLabel = (city: string) => city || unknownCity;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label =
    scope.kind === 'all'
      ? t.scopeAllLabel.replace('{count}', String(rows.length))
      : scope.kind === 'city'
        ? scope.cities.length
          ? scope.cities.map(cityLabel).join('、')
          : t.scopeCityNone
        : t.scopePickLabel.replace('{count}', String(scope.ids.length));

  const toggle = <T,>(list: readonly T[], value: T) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 max-w-full items-center gap-1 rounded-lg border border-brand-border bg-brand-card px-3 text-sm hover:border-brand-ink/30"
      >
        <span className="truncate">
          {t.scopeButton.replace('{label}', label)}
        </span>
        <span aria-hidden className="shrink-0 text-[10px] text-brand-text-muted">
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t.scope}
          className="absolute left-0 top-full z-30 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-brand-border bg-brand-card p-2 shadow-lg shadow-black/10"
        >
          <div className="flex gap-1.5 p-1">
            {(
              [
                ['all', t.scopeAll],
                ['city', t.scopeCity],
                ['pick', t.scopePick],
              ] as const
            ).map(([kind, text]) => (
              <button
                key={kind}
                type="button"
                aria-pressed={scope.kind === kind}
                onClick={() =>
                  onChange(kind === 'all' ? { kind } : kind === 'city' ? { kind, cities: [] } : { kind, ids: [] })
                }
                className={`${CHIP} ${
                  scope.kind === kind
                    ? 'border-transparent bg-brand-ink text-brand-on-ink'
                    : 'border-brand-border text-brand-text-muted hover:text-brand-text'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          {scope.kind === 'all' ? (
            <p className="px-2 py-2 text-sm text-brand-text-muted">
              {t.scopeAllHint.replace('{count}', String(rows.length))}
            </p>
          ) : null}
          {scope.kind === 'city' ? (
            <div className="mt-1 max-h-72 overflow-y-auto overscroll-contain">
              {cities.map((city) => (
                <label key={city || '-'} className={CHECK_ROW}>
                  <input
                    type="checkbox"
                    checked={scope.cities.includes(city)}
                    onChange={() => onChange({ kind: 'city', cities: toggle(scope.cities, city) })}
                  />
                  <span className="min-w-0 truncate">{cityLabel(city)}</span>
                  <span className="ml-auto shrink-0 text-xs text-brand-text-muted">
                    {t.storeCount.replace('{count}', String(rows.filter((r) => r.city === city).length))}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          {scope.kind === 'pick' ? (
            <>
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.scopeSearchPlaceholder}
                className="mt-1 min-h-10 w-full rounded-lg border border-brand-border bg-brand-bg px-3 text-sm"
              />
              <div className="mt-1 max-h-72 overflow-y-auto overscroll-contain">
                {rows
                  .filter((r) => rowMatchesSearch(r, query))
                  .map((r) => (
                    <label key={r.restaurantId} className={CHECK_ROW}>
                      <input
                        type="checkbox"
                        checked={scope.ids.includes(r.restaurantId)}
                        onChange={() => onChange({ kind: 'pick', ids: toggle(scope.ids, r.restaurantId) })}
                      />
                      <span className="min-w-0 truncate">{r.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-brand-text-muted">{cityLabel(r.city)}</span>
                    </label>
                  ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
