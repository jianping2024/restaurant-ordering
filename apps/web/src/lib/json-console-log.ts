/**
 * Sole structured console log line: `[channel] {"event":"…",…}`.
 * Used by order_append and waiter_buffet (and any future API event stream).
 */
export function logJsonConsoleEvent(
  channel: string,
  event: string,
  fields: Record<string, string | number | boolean | undefined | null> = {},
): void {
  const payload: Record<string, string | number | boolean> = { event };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    payload[key] = value;
  }
  console.info(`[${channel}]`, JSON.stringify(payload));
}
