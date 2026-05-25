'use client';

import type { Buffet, BuffetCalendarKind, BuffetPriceRule, BuffetTimeSlot } from '@/types';
import type { getMessages } from '@/lib/i18n/messages';
import { CALENDAR_KINDS, ruleCoversDate, todayIsoLocal } from '@/lib/buffet-pricing-admin';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

type Props = {
  buffetId: string;
  buffets: Buffet[];
  slots: BuffetTimeSlot[];
  rules: BuffetPriceRule[];
  t: BuffetAdminMessages;
  dayKindLabel: (k: BuffetCalendarKind) => string;
  onSetPrice: (opts: {
    buffetId: string;
    slotId: string;
    calendarKind: BuffetCalendarKind;
    existingRule?: BuffetPriceRule;
  }) => void;
};

function pickBestRule(
  rules: BuffetPriceRule[],
  buffetId: string,
  slotId: string,
  kind: BuffetCalendarKind,
  today: string,
): BuffetPriceRule | undefined {
  const candidates = rules
    .filter(
      (r) =>
        r.is_active &&
        r.buffet_id === buffetId &&
        r.time_slot_id === slotId &&
        r.calendar_kind === kind &&
        ruleCoversDate(r, today),
    )
    .sort((a, b) => b.priority - a.priority || String(b.valid_from).localeCompare(String(a.valid_from)));
  return candidates[0];
}

function formatSlotTime(start?: string | null, end?: string | null): string {
  const s = start?.slice(0, 5) ?? '—';
  const e = end?.slice(0, 5) ?? '—';
  return `${s}–${e}`;
}

export function BuffetPriceMatrix({
  buffetId,
  buffets,
  slots,
  rules,
  t,
  dayKindLabel,
  onSetPrice,
}: Props) {
  const buffet = buffets.find((b) => b.id === buffetId);
  const today = todayIsoLocal();

  if (!buffet) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border/70 px-4 py-10 text-center">
        <p className="text-sm text-brand-text-muted">{t.matrixSelectBuffet}</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-border/70 px-4 py-10 text-center">
        <p className="text-sm text-brand-text-muted">{t.needSlotAndBuffet}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[680px] text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] bg-brand-card px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70">
              {t.ruleSlot}
            </th>
            {CALENDAR_KINDS.map((k) => (
              <th
                key={k}
                className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70 min-w-[9.5rem]"
              >
                {dayKindLabel(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, rowIdx) => (
            <tr key={slot.id} className="group">
              <td
                className={`sticky left-0 z-[1] bg-brand-card px-3 py-3 align-middle border-b border-brand-border/40 ${
                  rowIdx === slots.length - 1 ? 'border-b-0' : ''
                }`}
              >
                <div className="font-medium text-brand-text whitespace-nowrap">{slot.name}</div>
                <div className="text-[11px] text-brand-text-muted tabular-nums mt-0.5">
                  {formatSlotTime(slot.start_time, slot.end_time)}
                </div>
              </td>
              {CALENDAR_KINDS.map((kind) => {
                const rule = pickBestRule(rules, buffetId, slot.id, kind, today);
                const isLastRow = rowIdx === slots.length - 1;
                return (
                  <td
                    key={kind}
                    className={`px-2 py-2.5 align-top border-b border-brand-border/40 ${isLastRow ? 'border-b-0' : ''}`}
                  >
                    {rule ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSetPrice({ buffetId, slotId: slot.id, calendarKind: kind, existingRule: rule })
                        }
                        className="text-left w-full rounded-lg border border-brand-border/50 bg-brand-bg/30 px-3 py-2.5 hover:border-brand-gold/50 hover:bg-brand-gold/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-brand-gold font-semibold tabular-nums">
                            €{Number(rule.adult_price).toFixed(2)}
                          </span>
                          <span className="text-brand-text-muted text-[11px]">/</span>
                          <span className="text-brand-text font-medium tabular-nums">
                            €{Number(rule.child_price).toFixed(2)}
                          </span>
                        </div>
                        <span className="block text-[10px] text-brand-text-muted mt-1 tabular-nums">
                          {rule.valid_from?.slice(0, 10)} → {rule.valid_to?.slice(0, 10)}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetPrice({ buffetId, slotId: slot.id, calendarKind: kind })}
                        className="flex items-center justify-center gap-1.5 w-full min-h-[3.25rem] rounded-lg border border-dashed border-brand-border/70 bg-transparent px-3 py-2 text-[12px] text-brand-text-muted hover:border-brand-gold/45 hover:bg-brand-gold/5 hover:text-brand-gold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
                      >
                        <span className="text-base leading-none font-light" aria-hidden>
                          +
                        </span>
                        {t.matrixSet}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
