'use client';

import type { LicenseExtendPeriod } from '@mesa/shared';
import { DatePicker } from '@mesa/ui';

/** Sole Ops quick-extend actions for Lisbon calendar entitlements (license + Pro). */
export const OPS_CALENDAR_EXTEND_ACTIONS = [
  { period: '1d' as const satisfies LicenseExtendPeriod, label: '+1 天' },
  { period: '1m' as const satisfies LicenseExtendPeriod, label: '+1 月' },
  { period: '1y' as const satisfies LicenseExtendPeriod, label: '+1 年' },
] as const;

type Props = {
  title: string;
  description: string;
  dateLabel: string;
  /** Lisbon YYYY-MM-DD for the DatePicker. */
  dateValue: string;
  minDate?: string;
  busy: boolean;
  disabled?: boolean;
  footerNote?: string;
  onDateChange: (ymd: string) => void;
  onUpdate: () => void | Promise<void>;
  onExtend: (period: LicenseExtendPeriod) => void | Promise<void>;
};

/**
 * Shared Ops calendar valid-until editor: DatePicker + +1d/+1m/+1y.
 * Used by license and Pro membership — one IA for the same calendar fact.
 */
export function OpsCalendarValidUntilEditor({
  title,
  description,
  dateLabel,
  dateValue,
  minDate,
  busy,
  disabled = false,
  footerNote,
  onDateChange,
  onUpdate,
  onExtend,
}: Props) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm text-zinc-400">
          {dateLabel}
          <DatePicker
            variant="zinc"
            lang="zh"
            value={dateValue}
            min={minDate}
            onChange={onDateChange}
            placeholder="选择截止日"
            className="mt-1 block min-w-[200px]"
            disabled={disabled || busy}
          />
        </label>
        {!disabled ? (
          <button
            type="button"
            disabled={busy || !dateValue}
            onClick={() => void onUpdate()}
            className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60"
          >
            更新
          </button>
        ) : null}
      </div>
      {!disabled ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {OPS_CALENDAR_EXTEND_ACTIONS.map((action) => (
            <button
              key={action.period}
              type="button"
              disabled={busy}
              onClick={() => void onExtend(action.period)}
              className="rounded border border-amber-500/40 bg-zinc-950 px-3 py-2 text-sm font-medium text-amber-400 disabled:opacity-60"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {footerNote ? <p className="mt-2 text-xs text-zinc-500">{footerNote}</p> : null}
    </section>
  );
}
