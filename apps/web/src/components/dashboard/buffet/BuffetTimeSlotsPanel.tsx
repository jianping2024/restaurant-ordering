'use client';

import type { BuffetTimeSlot } from '@/types';
import type { getMessages } from '@/lib/i18n/messages';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { SlotTimeHmField } from '@/components/dashboard/buffet/SlotTimeHmField';
import {
  buffetFieldClass,
  buffetSlotHeaderGrid,
  buffetSlotRowGrid,
} from '@/components/dashboard/buffet/buffet-field-styles';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

type Props = {
  slots: BuffetTimeSlot[];
  weekdayShort: readonly string[];
  t: BuffetAdminMessages;
  onAdd: () => void;
  onUpdateName: (slotId: string, name: string) => void;
  onUpdateStart: (slotId: string, hm: string) => void;
  onUpdateEnd: (slotId: string, hm: string) => void;
  onUpdateSort: (slotId: string, sort: number) => void;
  onToggleWeekday: (slot: BuffetTimeSlot, dow: number) => void;
  onDelete: (slotId: string) => void;
  onNameInvalid: () => void;
};

export function BuffetTimeSlotsPanel({
  slots,
  weekdayShort,
  t,
  onAdd,
  onUpdateName,
  onUpdateStart,
  onUpdateEnd,
  onUpdateSort,
  onToggleWeekday,
  onDelete,
  onNameInvalid,
}: Props) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-brand-text-muted max-w-xl">{t.guideStepSlots}</p>
        <button
          type="button"
          onClick={onAdd}
          className="text-sm px-3 py-1.5 rounded-lg bg-brand-gold/20 text-brand-gold border border-brand-gold/35 shrink-0"
        >
          {t.addSlot}
        </button>
      </div>

      {slots.length === 0 ? (
        <p className="text-brand-text-muted text-sm py-2">{t.addSlot}</p>
      ) : (
        <>
          <div className={buffetSlotHeaderGrid}>
            <span>{t.slotName}</span>
            <span>
              {t.start} — {t.end}
            </span>
            <span>{t.sortOrder}</span>
            <span>{t.weekdays}</span>
            <span className="sr-only">{t.delete}</span>
          </div>

          <ul className="space-y-2">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className={`border border-brand-border/60 rounded-lg px-3 py-2.5 space-y-2 ${buffetSlotRowGrid}`}
              >
                <div className="min-w-0">
                  <span className="md:sr-only text-[11px] text-brand-text-muted block mb-1">{t.slotName}</span>
                  <input
                    key={`${slot.id}-${slot.name}`}
                    className={`w-full max-w-[9rem] ${buffetFieldClass}`}
                    defaultValue={slot.name}
                    title={t.slotName}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v) {
                        onNameInvalid();
                        e.target.value = slot.name;
                        return;
                      }
                      if (v !== slot.name) onUpdateName(slot.id, v);
                    }}
                  />
                </div>

                <div className="min-w-0">
                  <span className="md:sr-only text-[11px] text-brand-text-muted block mb-1">
                    {t.start} — {t.end}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <SlotTimeHmField
                      compact
                      dbTime={slot.start_time || '11:00:00'}
                      onCommit={(hm) => onUpdateStart(slot.id, hm)}
                    />
                    <span className="text-brand-text-muted text-xs shrink-0">—</span>
                    <SlotTimeHmField
                      compact
                      dbTime={slot.end_time || '15:00:00'}
                      onCommit={(hm) => onUpdateEnd(slot.id, hm)}
                    />
                  </div>
                </div>

                <div>
                  <span className="md:sr-only text-[11px] text-brand-text-muted block mb-1">{t.sortOrder}</span>
                  <IntegerInput
                    className={`w-full max-w-[3.25rem] ${buffetFieldClass} tabular-nums`}
                    value={slot.sort_order ?? 0}
                    min={0}
                    onChange={(n) => onUpdateSort(slot.id, n)}
                  />
                </div>

                <div className="min-w-0">
                  <span className="md:sr-only text-[11px] text-brand-text-muted block mb-1">{t.weekdays}</span>
                  <div className="flex flex-wrap gap-1">
                    {weekdayShort.map((label, dow) => {
                      const on = (slot.weekdays || []).includes(dow);
                      return (
                        <button
                          key={dow}
                          type="button"
                          title={label}
                          onClick={() => onToggleWeekday(slot, dow)}
                          className={`h-8 min-w-[2rem] px-1.5 text-[11px] rounded-lg border transition-colors ${
                            on
                              ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold font-medium'
                              : 'border-brand-border text-brand-text-muted hover:border-brand-gold/30'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex md:justify-end">
                  <button
                    type="button"
                    onClick={() => onDelete(slot.id)}
                    className="text-[12px] mesa-text-danger border border-status-danger/35 px-2.5 py-1 rounded-lg hover:bg-status-danger/5"
                  >
                    {t.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
