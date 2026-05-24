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
    return <p className="text-sm text-brand-text-muted">{t.matrixSelectBuffet}</p>;
  }

  if (slots.length === 0) {
    return <p className="text-sm text-brand-text-muted">{t.needSlotAndBuffet}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border/60">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-brand-border bg-brand-border/20 text-[12px] text-brand-text-muted">
            <th className="px-3 py-2 text-left font-medium">{t.ruleSlot}</th>
            {CALENDAR_KINDS.map((k) => (
              <th key={k} className="px-3 py-2 text-left font-medium">
                {dayKindLabel(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.id} className="border-b border-brand-border/50 last:border-0">
              <td className="px-3 py-2.5 text-brand-text font-medium whitespace-nowrap">
                {slot.name}
                <span className="block text-[11px] text-brand-text-muted font-normal">
                  {slot.start_time?.slice(0, 5)}–{slot.end_time?.slice(0, 5)}
                </span>
              </td>
              {CALENDAR_KINDS.map((kind) => {
                const rule = pickBestRule(rules, buffetId, slot.id, kind, today);
                return (
                  <td key={kind} className="px-3 py-2.5 align-top">
                    {rule ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSetPrice({ buffetId, slotId: slot.id, calendarKind: kind, existingRule: rule })
                        }
                        className="text-left w-full rounded-lg border border-brand-border/50 px-2 py-1.5 hover:border-brand-gold/40 hover:bg-brand-gold/5 transition-colors"
                      >
                        <span className="text-brand-gold font-medium">
                          €{Number(rule.adult_price).toFixed(2)} / €{Number(rule.child_price).toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-brand-text-muted mt-0.5">
                          {rule.valid_from?.slice(0, 10)} → {rule.valid_to?.slice(0, 10)}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetPrice({ buffetId, slotId: slot.id, calendarKind: kind })}
                        className="text-[12px] text-brand-text-muted border border-dashed border-brand-border rounded-lg px-2 py-2 w-full hover:border-brand-gold/50 hover:text-brand-gold"
                      >
                        {t.matrixUnset} · {t.matrixSet}
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
