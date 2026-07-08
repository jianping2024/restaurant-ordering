import type { OrderItem } from '@/types';

export type OrderAppendCooldownCheckResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export type OrderAppendCooldownContext = {
  nowMs: number;
  cooldownSeconds: number;
  sessionOrders: Array<{ items: OrderItem[] }>;
};

function parseFiniteMs(iso?: string | null): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function isBuffetBaseItem(item: Pick<OrderItem, 'kind'>): boolean {
  return item.kind === 'buffet_base';
}

function pickLastMenuItemAddedAtMs(sessionOrders: Array<{ items: OrderItem[] }>): number | null {
  let last: number | null = null;

  for (const order of sessionOrders) {
    for (const item of order.items) {
      // Buffet_base is the auto buffet baseline: exclude from "customer add-to-cart" rate limiting.
      if (isBuffetBaseItem(item)) continue;

      const addedAtMs = parseFiniteMs(item.added_at);
      if (addedAtMs == null) continue;
      if (last == null || addedAtMs > last) last = addedAtMs;
    }
  }

  return last;
}

export function checkOrderAppendCooldown(params: OrderAppendCooldownContext): OrderAppendCooldownCheckResult {
  const { nowMs, cooldownSeconds, sessionOrders } = params;

  // Defensive: DB enforces [5,60], but keep this function pure and safe.
  const effectiveCooldownSec = Math.max(5, Math.min(60, Math.floor(cooldownSeconds)));
  const cooldownMs = effectiveCooldownSec * 1000;

  const lastMenuAddedAtMs = pickLastMenuItemAddedAtMs(sessionOrders);
  if (lastMenuAddedAtMs == null) return { ok: true };

  const elapsedMs = nowMs - lastMenuAddedAtMs;
  if (elapsedMs >= cooldownMs) return { ok: true };

  const remainingMs = Math.max(0, cooldownMs - elapsedMs);
  const retryAfterSec = Math.max(1, Math.ceil(remainingMs / 1000));
  return { ok: false, retryAfterSec };
}

