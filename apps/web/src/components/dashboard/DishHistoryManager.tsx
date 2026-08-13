'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import type { DishHistoryRow } from '@/lib/dish-history-server';

type Props = {
  restaurantSlug: string;
};

export function DishHistoryManager({ restaurantSlug }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).dishHistory;
  const locale = UI_LOCALE_BY_LANG[lang];
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20);
  const [rows, setRows] = useState<DishHistoryRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remakeTarget, setRemakeTarget] = useState<DishHistoryRow | null>(null);
  const [remakeQty, setRemakeQty] = useState(1);
  const [remaking, setRemaking] = useState(false);

  const load = useCallback(
    async (opts: { cursor?: string | null; append?: boolean } = {}) => {
      setLoading(true);
      setError('');
      try {
        const url = new URL(
          `/api/restaurants/${encodeURIComponent(restaurantSlug)}/staff/dish-history`,
          window.location.origin,
        );
        if (qApplied.trim()) url.searchParams.set('q', qApplied.trim());
        url.searchParams.set('page_size', String(pageSize));
        url.searchParams.set('lang', lang);
        if (opts.cursor) url.searchParams.set('cursor', opts.cursor);
        const res = await fetch(url.toString(), { credentials: 'include' });
        const data = (await res.json().catch(() => ({}))) as {
          rows?: DishHistoryRow[];
          next_cursor?: string | null;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'load_failed');
        setRows((prev) => (opts.append ? [...prev, ...(data.rows || [])] : data.rows || []));
        setNextCursor(data.next_cursor ?? null);
      } catch {
        setError(t.loadFail);
      } finally {
        setLoading(false);
      }
    },
    [restaurantSlug, qApplied, pageSize, lang, t.loadFail],
  );

  useEffect(() => {
    void load({});
  }, [load]);

  const search = () => {
    setQApplied(q.trim());
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
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (data.error === 'no_active_session') {
          setError(t.noActiveSession);
        } else {
          setError(t.remakeFail);
        }
        return;
      }
      setRemakeTarget(null);
      await load({});
    } catch {
      setError(t.remakeFail);
    } finally {
      setRemaking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t.searchLabel}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.searchPlaceholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search();
            }}
          />
        </div>
        <Button type="button" onClick={search} loading={loading} className="sm:mb-0.5">
          {t.search}
        </Button>
        <label className="text-sm text-brand-text-muted sm:mb-0.5">
          {t.pageSize}
          <select
            className="ml-2 rounded-lg border border-brand-border bg-brand-card px-2 py-2 text-brand-text"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as 20 | 50 | 100)}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {error ? <p className="mesa-alert-danger text-sm px-4 py-2">{error}</p> : null}

      {rows.length === 0 && !loading ? (
        <p className="text-sm text-brand-text-muted text-center py-12">{t.empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
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

      {nextCursor ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            loading={loading}
            onClick={() => void load({ cursor: nextCursor, append: true })}
          >
            {t.loadMore}
          </Button>
        </div>
      ) : null}

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
