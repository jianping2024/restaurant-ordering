/** IANA timezone, e.g. `Asia/Shanghai`, `Europe/Lisbon`. */
export function getZonedCalendarParts(
  date: Date,
  timeZone: string,
): { dateKey: string; hour: number; minute: number } {
  const d = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = (t: Intl.DateTimeFormatPart['type']) =>
    d.find((p) => p.type === t)?.value ?? '0';

  const y = part('year');
  const m = part('month');
  const day = part('day');
  return {
    dateKey: `${y}-${m}-${day}`,
    hour: Number(part('hour')),
    minute: Number(part('minute')),
  };
}
