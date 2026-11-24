'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { restaurantApiPath } from '@/lib/dashboard-store-routes';
import { STORE_PICKER_MESSAGES } from '@/lib/i18n/store-picker-messages';
import type { AuthorizedRestaurant } from '@/lib/permissions/restaurant-access-rules';
import {
  buildStoreListGroups,
  nextRecentStoreIds,
  recentStoresStorageKey,
  storeDisplayName,
  storeIsSuspended,
  type StoreListGroup,
} from '@/lib/store-list-model';

function readRecentIds(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(recentStoresStorageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecentIds(userId: string, ids: string[]): void {
  try {
    window.localStorage.setItem(recentStoresStorageKey(userId), JSON.stringify(ids));
  } catch {
    // UX only — private mode / blocked storage just loses «最近进过».
  }
}

/** Full navigation so providers + Realtime reload for the new store (plan §8.2). */
export function enterStore(userId: string, store: AuthorizedRestaurant): void {
  writeRecentIds(userId, nextRecentStoreIds(readRecentIds(userId), store.id));
  window.location.assign(store.landingPath);
}

type Props = {
  stores: readonly AuthorizedRestaurant[];
  userId: string;
  /** Store open in this tab (✓, Enter just closes). */
  currentRestaurantId?: string | null;
  autoFocus?: boolean;
  /** Scroll area height, e.g. `max-h-[60vh]`. */
  scrollClassName: string;
  onClose?: () => void;
};

/**
 * Sole searchable store list (plan §8.1–8.2) — store picker page and top-bar switcher.
 * Search by name / city; ↑↓ + Enter; groups favorites → recent (≤5) → all by city; star
 * toggles the favorite (`PUT|DELETE …/favorite`). Suspended stores are greyed, not enterable.
 */
export function StoreList({
  stores,
  userId,
  currentRestaurantId = null,
  autoFocus = false,
  scrollClassName,
  onClose,
}: Props) {
  const { lang } = useLanguage();
  const t = STORE_PICKER_MESSAGES[lang];
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<ReadonlyMap<string, string | null>>(
    () => new Map(stores.map((s) => [s.id, s.favoritedAt])),
  );
  const [favoriteError, setFavoriteError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecentIds(readRecentIds(userId));
  }, [userId]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const groups = useMemo(
    () =>
      buildStoreListGroups(
        stores.map((s) => ({ ...s, favoritedAt: favorites.get(s.id) ?? null })),
        { query, recentIds },
      ),
    [stores, favorites, query, recentIds],
  );

  /** Keyboard order: enterable rows as displayed (a store may show in two groups). */
  const enterableRows = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.filter((s) => !storeIsSuspended(s)).map((s) => ({ key: `${g.kind}:${s.id}`, store: s })),
      ),
    [groups],
  );
  const highlightKey = enterableRows[Math.min(highlight, enterableRows.length - 1)]?.key ?? null;

  useEffect(() => {
    if (!highlightKey) return;
    scrollRef.current
      ?.querySelector(`[data-row-key="${CSS.escape(highlightKey)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlightKey]);

  const enter = (store: AuthorizedRestaurant) => {
    if (storeIsSuspended(store)) return;
    if (store.id === currentRestaurantId) {
      onClose?.();
      return;
    }
    enterStore(userId, store);
  };

  const toggleFavorite = async (store: AuthorizedRestaurant) => {
    const previous = favorites.get(store.id) ?? null;
    const next = previous ? null : new Date().toISOString();
    setFavoriteError(false);
    setFavorites((m) => new Map(m).set(store.id, next));
    try {
      const res = await fetch(restaurantApiPath(store.slug, '/favorite'), {
        method: next ? 'PUT' : 'DELETE',
        credentials: 'include',
      });
      const json = (await res.json().catch(() => ({}))) as { favorited_at?: string | null };
      if (!res.ok) throw new Error('favorite_failed');
      setFavorites((m) => new Map(m).set(store.id, json.favorited_at ?? next));
    } catch {
      setFavorites((m) => new Map(m).set(store.id, previous));
      setFavoriteError(true);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!enterableRows.length) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => (h + delta + enterableRows.length) % enterableRows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = enterableRows.find((r) => r.key === highlightKey);
      if (row) enter(row.store);
    }
  };

  const groupTitle = (g: StoreListGroup) => {
    if (g.kind === 'favorites') return t.favorites;
    if (g.kind === 'recent') return t.recent;
    if (g.kind === 'all') return t.all.replace('{count}', String(g.items.length));
    return t.results.replace('{count}', String(g.items.length));
  };

  const anyRow = groups.some((g) => g.items.length > 0);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={t.searchPlaceholder}
        aria-label={t.searchPlaceholder}
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-brand-border bg-brand-bg px-3 text-base text-brand-text placeholder:text-brand-text-muted focus:border-brand-gold focus:outline-none"
      />
      {favoriteError ? (
        <p role="alert" className="px-1 text-xs text-status-danger">
          {t.favoriteFailed}
        </p>
      ) : null}
      <div ref={scrollRef} className={`min-w-0 overflow-y-auto overscroll-contain ${scrollClassName}`}>
        {groups.map((g) => {
          let lastCity: string | null = null;
          return (
            <section key={g.kind} aria-label={groupTitle(g)} className="pb-1">
              <h3 className="px-2 pb-1 pt-2 text-xs font-medium text-brand-text-muted">{groupTitle(g)}</h3>
              {g.items.map((store) => {
                const key = `${g.kind}:${store.id}`;
                const suspended = storeIsSuspended(store);
                const current = store.id === currentRestaurantId;
                const starred = !!favorites.get(store.id);
                const cityHeader = g.kind === 'all' && store.city !== lastCity;
                lastCity = store.city;
                const meta = [store.roleName, store.city, suspended ? t.suspended : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Fragment key={key}>
                    {cityHeader ? (
                      <p className="px-2 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-brand-text-muted/80">
                        {store.city || t.unknownCity}
                      </p>
                    ) : null}
                    <div className="flex min-w-0 items-center gap-1">
                      <button
                        type="button"
                        data-row-key={key}
                        disabled={suspended}
                        aria-current={current ? 'true' : undefined}
                        onClick={() => enter(store)}
                        onMouseEnter={() => {
                          const i = enterableRows.findIndex((r) => r.key === key);
                          if (i >= 0) setHighlight(i);
                        }}
                        className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          key === highlightKey ? 'bg-brand-border/60' : 'hover:bg-brand-border/40'
                        }`}
                      >
                        <span className="w-4 shrink-0 text-brand-text" aria-hidden>
                          {current ? '✓' : ''}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-brand-text">{storeDisplayName(store)}</span>
                          {meta ? (
                            <span className="block truncate text-xs text-brand-text-muted">{meta}</span>
                          ) : null}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleFavorite(store)}
                        disabled={suspended}
                        aria-pressed={starred}
                        aria-label={`${starred ? t.unfavorite : t.favorite}: ${storeDisplayName(store)}`}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg transition-colors hover:bg-brand-border/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                          starred ? 'text-brand-gold' : 'text-brand-text-muted'
                        }`}
                      >
                        {starred ? '★' : '☆'}
                      </button>
                    </div>
                  </Fragment>
                );
              })}
            </section>
          );
        })}
        {!anyRow ? <p className="px-2 py-4 text-sm text-brand-text-muted">{t.noMatch}</p> : null}
      </div>
    </div>
  );
}
