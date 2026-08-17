'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import type { DishHistoryListResult, DishHistoryRow } from '@/lib/dish-history-server';
import { type ListPageSize } from '@/lib/paginate-list';
import { useDashboardListQuery } from '@/lib/use-dashboard-list-query';

type Props = {
  restaurantSlug: string;
};

type Filters = { q: string };

export function DishHistoryManager({ restaurantSlug }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).dishHistory;
  const locale = UI_LOCALE_BY_LANG[lang];
  const [qDraft, setQDraft] = useState('');
  const [error, setError] = useState('');
  const [remakeTarget, setRemakeTarget] = useState<DishHistoryRow | null>(null);
  const [remakeQty, setRemakeQty] = useState(1);
  const [remaking, setRemaking] = useState(false);

  const fetchList = useCallback(
    async ({
      filters,
      page,
      pageSize,
      signal,
    }: {
      filters: Filters;
      page: number;
      pageSize: ListPageSize;
      signal: AbortSignal;
    }) => {
      const url = new URL(
        `/api/restaurants/${encodeURIComponent(restaurantSlug)}/staff/dish-history`,
        window.location.origin,
      );
      if (filters.q.trim()) url.searchParams.set('q', filters.q.trim());
      url.searchParams.set('page', String(page));
      url.searchParams.set('page_size', String(pageSize));
      url.searchParams.set('lang', lang);
      try {
        const res = await fetch(url.toString(), { credentials: 'include', signal });
        const data = (await res.json().catch(() => ({}))) as DishHistoryListResult & {
          error?: string;
        };
        if (!res.ok) return { ok: false as const, error: data.error || 'load_failed' };
        return { ok: true as const, data };
      } catch (err) {
        if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          return { ok: false as const, error: 'aborted' };
        }
        return { ok: false as const, error: 'network_error' };
      }
    },
    [restaurantSlug, lang],
  );

  const {
    replaceDraftFilters,
    query,
    data,
    loading,
    setPage,
    setPageSize,
    refresh,
  } = useDashboardListQuery<Filters, DishHistoryListResult>({
    initialFilters: { q: '' },
    debounceMs: 0,
    fetchList,
    onFetchError: () => setError(t.loadFail),
    onSuccess: () => setError(''),
  });

  const search = () => {
    replaceDraftFilters({ q: qDraft.trim() });
  };
  const openRemake = (row: DishHistoryRow) => {
    setRemakeTarget(row);
    setRemakeQty(Math.max(1, Math.floor(row.qty) || 1));
  };

  const confirmRemake = async () => {
    if (!remakeTarget) return;
    setRemaking(true);
    setError('');
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurantSlug)}/staff/dish-history/remake`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: remakeTarget.order_id,
            item_index: remakeTarget.item_index,
            qty: remakeQty,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (body.error === 'no_active_session') {
          setError(t.noActiveSession);
        } else {
          setError(t.remakeFail);
        }
        return;
      }
      setRemakeTarget(null);
      refresh();
    } catch {
      setError(t.remakeFail);
    } finally {
      setRemaking(false);
    }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const showInitialLoading = loading && !data;
  const listBusy = loading && !!data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t.searchLabel}
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder={t.searchPlaceholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search();
            }}
          />
        </div>
        <Button type="button" onClick={search} loading={loading} className="sm:mb-0.5">
          {t.search}
        </Button>
      </div>

      {error ? <p className="mesa-alert-danger text-sm px-4 py-2">{error}</p> : null}

      {showInitialLoading ? (
        <p className="text-sm text-brand-text-muted text-center py-12">{t.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-brand-text-muted text-center py-12">{t.empty}</p>
      ) : (
        <ul className={`space-y-2 ${listBusy ? 'opacity-60' : ''}`}>
          {items.map((row) => {
            const time = new Date(row.added_at).toLocaleString(locale, {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <li
                key={`${row.order_id}-${row.item_index}-${row.added_at}`}
                className="rounded-xl border border-brand-border bg-brand-card px-4 py-3 flex flex-wrap items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-brand-text font-medium">
                    {row.name}
                    {row.item_code ? (
                      <span className="ml-2 text-[12px] text-brand-text-muted">#{row.item_code}</span>
                    ) : null}
                    <span className="ml-2 text-brand-gold">× {row.qty}</span>
                  </p>
                  <p className="text-[12px] text-brand-text-muted mt-0.5">
                    {t.table} {row.table_display} · {time}
                    {row.kitchen_remake ? ` · ${t.remakeTag}` : ''}
                    {!row.session_open ? ` · ${t.sessionClosed}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!row.session_open}
                  onClick={() => openRemake(row)}
                >
                  {t.remake}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <ListPaginationBar
        page={query.page}
        totalPages={totalPages}
        total={total}
        pageSize={query.pageSize}
        labels={{
          pageInfo: t.pageInfo,
          pageSizeLabel: t.pageSizeLabel,
          pagePrev: t.pagePrev,
          pageNext: t.pageNext,
        }}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        disabled={loading}
      />

      <Modal
        open={!!remakeTarget}
        onClose={() => {
          if (!remaking) setRemakeTarget(null);
        }}
        title={t.remakeTitle}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-text">
            {remakeTarget
              ? t.remakeBody
                  .replace('{name}', remakeTarget.name)
                  .replace('{table}', remakeTarget.table_display)
              : ''}
          </p>
          <Input
            label={t.qtyLabel}
            type="number"
            min={1}
            max={99}
            value={String(remakeQty)}
            onChange={(e) => setRemakeQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemakeTarget(null)} disabled={remaking}>
              {t.cancel}
            </Button>
            <Button onClick={() => void confirmRemake()} loading={remaking}>
              {t.confirmRemake}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
