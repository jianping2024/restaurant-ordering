export const ORDER_COOLDOWN_SECONDS_MIN = 5;
export const ORDER_COOLDOWN_SECONDS_MAX = 60;
export const DEFAULT_ORDER_COOLDOWN_SECONDS = 5;

/** Clamp owner-configured menu submit button wait (5–60 seconds). */
export function clampOrderCooldownSeconds(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_ORDER_COOLDOWN_SECONDS;
  const rounded = Math.round(n);
  return Math.max(
    ORDER_COOLDOWN_SECONDS_MIN,
    Math.min(ORDER_COOLDOWN_SECONDS_MAX, rounded),
  );
}

export function formatSubmitCooldownWaitMessage(template: string, seconds: number): string {
  return template.replace('{seconds}', String(Math.max(0, Math.floor(seconds))));
}
