'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Buffet, BuffetTimeSlot } from '@/types';
import type { UILanguage } from '@/lib/i18n';
import type { getMessages } from '@/lib/i18n/messages';
import {
  getDayKindForDateTime,
  lisbonWallTimeToUtcIso,
  nowTimeHmLocal,
  todayIsoLocal,
  type CalendarOverrideRow,
} from '@/lib/buffet-pricing-admin';
import { DashboardDatePicker } from '@/components/dashboard/DashboardDatePicker';
import { Button } from '@/components/ui/Button';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

type Resolved = {
  adult_price: number | null;
  child_price: number | null;
  rule_id: string | null;
  time_slot_id: string | null;
};

type Props = {
  restaurantId: string;
  buffets: Buffet[];
  slots: BuffetTimeSlot[];
  calendarRows: CalendarOverrideRow[];
  fridayWeekendFrom?: string | null;
  t: BuffetAdminMessages;
  lang: UILanguage;
  dayKindLabel: (kind: string) => string;
};

export function BuffetPricePreview({
  restaurantId,
  buffets,
  slots,
  calendarRows,
  fridayWeekendFrom,
  t,
  lang,
  dayKindLabel,
}: Props) {
  const supabase = createClient();
  const activeBuffets = buffets.filter((b) => b.is_active);

  const [buffetId, setBuffetId] = useState('');
  const [date, setDate] = useState(todayIsoLocal);
  const [time, setTime] = useState(nowTimeHmLocal);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [ran, setRan] = useState(false);

  useEffect(() => {
    if (!buffetId && activeBuffets[0]) setBuffetId(activeBuffets[0].id);
  }, [activeBuffets, buffetId]);

  const runPreview = useCallback(
    async (atIso?: string) => {
      if (!buffetId) return;
      setLoading(true);
      setRan(true);
      try {
        const pAt = atIso ?? lisbonWallTimeToUtcIso(date, time);
        const { data, error } = await supabase.rpc('resolve_buffet_prices', {
          p_restaurant_id: restaurantId,
          p_buffet_id: buffetId,
          p_at: pAt,
        });
        if (error) {
          setResolved(null);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        setResolved({
          adult_price: row?.adult_price != null ? Number(row.adult_price) : null,
          child_price: row?.child_price != null ? Number(row.child_price) : null,
          rule_id: row?.rule_id ?? null,
          time_slot_id: row?.time_slot_id ?? null,
        });
      } finally {
        setLoading(false);
      }
    },
    [buffetId, date, time, restaurantId, supabase],
  );

  const previewNow = () => {
    const now = new Date();
    const d = todayIsoLocal();
    const hm = nowTimeHmLocal();
    setDate(d);
    setTime(hm);
    void runPreview(now.toISOString());
  };

  const dayKind = date
    ? getDayKindForDateTime(date, time, calendarRows, { fridayWeekendFrom })
    : null;
  const slotName = resolved?.time_slot_id
    ? slots.find((s) => s.id === resolved.time_slot_id)?.name
    : null;

  if (activeBuffets.length === 0) return null;

  return (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium text-brand-text">{t.previewTitle}</h2>
        <p className="text-[12px] text-brand-text-muted mt-0.5">{t.previewLisbonNote}</p>
      </div>
      <div className="flex flex-wrap gap-3 items-end text-sm">
        <label className="text-brand-text-muted text-[12px] min-w-[140px]">
          {t.previewBuffet}
          <select
            className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-brand-text"
            value={buffetId}
            onChange={(e) => setBuffetId(e.target.value)}
          >
            {activeBuffets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-brand-text-muted text-[12px]">
          {t.previewDate}
          <DashboardDatePicker
            className="mt-0.5 w-full min-w-[160px]"
            value={date}
            onChange={setDate}
            lang={lang}
            placeholder={t.pickDate}
          />
        </label>
        <label className="text-brand-text-muted text-[12px]">
          {t.previewTime}
          <input
            type="time"
            className="mt-0.5 block rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-brand-text"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <Button type="button" size="sm" variant="gold" loading={loading} onClick={() => void runPreview()}>
          {t.previewRun}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={previewNow}>
          {t.previewNow}
        </Button>
      </div>

      {dayKind && (
        <p className="text-[13px] text-brand-text-muted">
          {t.previewDayKind}: <span className="text-brand-text">{dayKindLabel(dayKind)}</span>
        </p>
      )}

      {ran && !loading && (
        <div className="rounded-lg border border-brand-border/60 bg-brand-card px-3 py-2 text-sm">
          {resolved?.adult_price != null && resolved?.child_price != null ? (
            <div className="space-y-1">
              <p className="text-brand-text font-medium">
                {t.previewPrices}:{' '}
                <span className="text-brand-gold">
                  €{resolved.adult_price.toFixed(2)} / €{resolved.child_price.toFixed(2)}
                </span>
              </p>
              {slotName && (
                <p className="text-brand-text-muted text-[13px]">
                  {t.previewSlot}: {slotName}
                </p>
              )}
            </div>
          ) : (
            <p className="mesa-alert-warning px-3 py-2 text-[13px] leading-relaxed">{t.previewNoRule}</p>
          )}
        </div>
      )}
      {loading && <p className="text-[13px] text-brand-text-muted">{t.previewLoading}</p>}
    </div>
  );
}
