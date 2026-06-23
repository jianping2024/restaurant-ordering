import { PRINT_AGENT_CREDENTIAL_REMINDER_BEFORE_DAYS } from '@/lib/print-agent-credential';

export type PrintAgentDeviceRow = {
  id: string;
  label: string | null;
  valid_until: string;
  revoked_at?: string | null;
};

export function devicesNeedingRenewal(
  devices: PrintAgentDeviceRow[],
  now = new Date(),
): PrintAgentDeviceRow[] {
  const reminderMs = PRINT_AGENT_CREDENTIAL_REMINDER_BEFORE_DAYS * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  return devices.filter((d) => {
    if (d.revoked_at) return false;
    const untilMs = new Date(d.valid_until).getTime();
    if (Number.isNaN(untilMs) || untilMs <= nowMs) return false;
    return untilMs - nowMs <= reminderMs;
  });
}

export function daysUntilValidUntil(validUntil: string, now = new Date()): number {
  const untilMs = new Date(validUntil).getTime();
  const diff = untilMs - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function formatValidUntilDate(validUntil: string, locale: string): string {
  return new Date(validUntil).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
