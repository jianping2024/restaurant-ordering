'use client';

import { useState } from 'react';
import type { Buffet, BuffetCalendarKind, BuffetPriceRule } from '@/types';
import type { UILanguage } from '@/lib/i18n';
import type { getMessages } from '@/lib/i18n/messages';
import {
  datesInRangeInclusive,
  getDayKindForDate,
  hasActiveRuleForDayKind,
  type CalendarOverrideRow,
} from '@/lib/buffet-pricing-admin';
import { DashboardDatePicker } from '@/components/dashboard/DashboardDatePicker';
import { showToast } from '@/components/ui/Toast';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

type Props = {
  calendarRows: CalendarOverrideRow[];
  rules: BuffetPriceRule[];
  buffets: Buffet[];
  t: BuffetAdminMessages;
  lang: UILanguage;
  dayKindLabel: (k: BuffetCalendarKind) => string;
  onUpsert: (rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>) => Promise<void>;
  onRemove: (onDate: string) => void;
  onAddRuleForKind: (calendarKind: BuffetCalendarKind) => void;
};

export function BuffetCalendarPanel({
  calendarRows,
  rules,
  buffets,
  t,
  lang,
  dayKindLabel,
  onUpsert,
  onRemove,
  onAddRuleForKind,
}: Props) {
  const [calDate, setCalDate] = useState('');
  const [calKind, setCalKind] = useState<'holiday' | 'special'>('holiday');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const primaryBuffetId = buffets.find((b) => b.is_active)?.id ?? buffets[0]?.id;

  const addSingle = async () => {
    if (!calDate) return;
    setSubmitting(true);
    try {
      await onUpsert([{ on_date: calDate, kind: calKind }]);
      setCalDate('');
    } finally {
      setSubmitting(false);
    }
  };

  const addRange = async () => {
    if (!rangeFrom || !rangeTo) return;
    if (rangeTo < rangeFrom) {
      showToast(t.calendarRangeInvalid, 'error');
      return;
    }
    const dates = datesInRangeInclusive(rangeFrom, rangeTo);
    if (dates.length === 0) return;
    setSubmitting(true);
    try {
      await onUpsert(dates.map((on_date) => ({ on_date, kind: calKind })));
      setRangeFrom('');
      setRangeTo('');
    } finally {
      setSubmitting(false);
    }
  };

  const kindForOverride = (kind: 'holiday' | 'special'): BuffetCalendarKind =>
    kind === 'holiday' ? 'holiday' : 'special';

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-brand-text-muted max-w-2xl">{t.exceptionsIntro}</p>

      <div className="rounded-xl border border-brand-border/60 p-4 space-y-4 bg-brand-bg/30">
        <p className="text-[12px] font-medium text-brand-text-muted">{t.addCalendar}</p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-brand-text-muted text-[12px] block min-w-[180px]">
            {t.calendarDate}
            <DashboardDatePicker
              className="mt-0.5 w-full max-w-[240px]"
              value={calDate}
              onChange={setCalDate}
              lang={lang}
              placeholder={t.pickDate}
            />
          </label>
          <label className="text-brand-text-muted text-[12px]">
            {t.calendarTag}
            <select
              className="mt-0.5 block rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-brand-text"
              value={calKind}
              onChange={(e) => setCalKind(e.target.value as 'holiday' | 'special')}
            >
              <option value="holiday">{t.holiday}</option>
              <option value="special">{t.special}</option>
            </select>
          </label>
          <button
            type="button"
            disabled={submitting || !calDate}
            onClick={() => void addSingle()}
            className="text-sm px-3 py-1.5 rounded-lg bg-brand-gold text-brand-bg font-medium disabled:opacity-50"
          >
            {t.addCalendar}
          </button>
        </div>

        <div className="border-t border-brand-border/50 pt-4">
          <p className="text-[12px] font-medium text-brand-text-muted mb-2">{t.addCalendarRange}</p>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-brand-text-muted text-[12px]">
              {t.calendarRangeFrom}
              <DashboardDatePicker
                className="mt-0.5 w-full min-w-[160px]"
                value={rangeFrom}
                onChange={setRangeFrom}
                lang={lang}
                placeholder={t.pickDate}
              />
            </label>
            <label className="text-brand-text-muted text-[12px]">
              {t.calendarRangeTo}
              <DashboardDatePicker
                className="mt-0.5 w-full min-w-[160px]"
                value={rangeTo}
                onChange={setRangeTo}
                lang={lang}
                placeholder={t.pickDate}
              />
            </label>
            <label className="text-brand-text-muted text-[12px]">
              {t.calendarTag}
              <select
                className="mt-0.5 block rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-brand-text"
                value={calKind}
                onChange={(e) => setCalKind(e.target.value as 'holiday' | 'special')}
              >
                <option value="holiday">{t.holiday}</option>
                <option value="special">{t.special}</option>
              </select>
            </label>
            <button
              type="button"
              disabled={submitting || !rangeFrom || !rangeTo}
              onClick={() => void addRange()}
              className="text-sm px-3 py-1.5 rounded-lg border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 disabled:opacity-50"
            >
              {t.addCalendarRange}
            </button>
          </div>
        </div>
      </div>

      <ul className="space-y-2 text-sm">
        {calendarRows.length === 0 ? (
          <li className="text-brand-text-muted text-center py-6 border border-dashed border-brand-border rounded-xl">
            {t.exceptionsIntro}
          </li>
        ) : (
          calendarRows.map((row) => {
            const date = row.on_date.slice(0, 10);
            const calKind = kindForOverride(row.kind);
            const kindName = dayKindLabel(calKind);
            const covered =
              primaryBuffetId &&
              hasActiveRuleForDayKind(rules, {
                buffetId: primaryBuffetId,
                calendarKind: calKind,
                dateIso: date,
              });
            const wouldBe = getDayKindForDate(date, calendarRows);

            return (
              <li
                key={row.on_date}
                className="flex flex-wrap gap-2 justify-between items-start border border-brand-border/50 rounded-lg px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-brand-text font-medium">{date}</span>
                  <span className="text-brand-text-muted"> — {row.kind === 'holiday' ? t.holiday : t.special}</span>
                  <p className="text-[12px] mt-1 text-brand-text-muted">
                    {t.previewDayKind}: {dayKindLabel(wouldBe)}
                  </p>
                  {primaryBuffetId && (
                    <p
                      className={`text-[12px] mt-0.5 ${covered ? 'text-emerald-400/90' : 'text-amber-300/90'}`}
                    >
                      {covered
                        ? t.calendarCoverageOk.replace('{kind}', kindName)
                        : t.calendarCoverageMissing.replace('{kind}', kindName)}
                    </p>
                  )}
                  {!covered && (
                    <button
                      type="button"
                      onClick={() => onAddRuleForKind(calKind)}
                      className="text-[12px] text-brand-gold mt-1 hover:underline"
                    >
                      {t.calendarAddRule} →
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(date)}
                  className="text-[12px] text-rose-700 shrink-0"
                >
                  {t.removeCalendar}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
