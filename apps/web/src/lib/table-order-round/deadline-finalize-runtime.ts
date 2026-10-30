import 'server-only';

import { waitUntil } from '@vercel/functions';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  settleDueTableOrderRoundSubmit,
  sweepDueTableOrderRoundSubmits,
} from '@/lib/table-order-round/service';

const ARM_SLACK_MS = 250;
const SWEEP_INTERVAL_MS = 10_000;

type GlobalDeadlineRuntime = typeof globalThis & {
  __mesaRoundDeadlineSweepStarted?: boolean;
};

/**
 * Exact-deadline arm after submit-request. Call inside the request handler: on Vercel the
 * wait + settle is registered with `waitUntil`, so the instance is not frozen between the
 * idempotency claim and the append (a frozen settle holds the claim and every other
 * finalize gets `append_in_progress`). Long-lived Node (on-prem / next dev) has no request
 * context — `waitUntil` is a no-op there and the timer simply runs in-process.
 */
export function armTableOrderRoundDeadlineFinalize(input: {
  restaurantId: string;
  sessionId: string;
  submitDeadlineAt: string;
}): void {
  ensureTableOrderRoundDeadlineSweep();

  const dueAt = Date.parse(input.submitDeadlineAt);
  if (!Number.isFinite(dueAt)) return;

  const delay = Math.max(0, dueAt - Date.now()) + ARM_SLACK_MS;
  waitUntil(
    new Promise<void>((resolve) => setTimeout(resolve, delay)).then(async () => {
      try {
        const admin = createAdminClient();
        await settleDueTableOrderRoundSubmit({
          admin,
          restaurantId: input.restaurantId,
          sessionId: input.sessionId,
        });
      } catch (e) {
        console.error('[mesa sushi-round] deadline arm settle failed:', e);
      }
    }),
  );
}

/**
 * In-process safety sweep for long-lived Node only (catches arms lost to a restart).
 * Not on Vercel: an interval outside any request runs on a frozen instance and can strand
 * an idempotency claim mid-append. Idempotent via globalThis.
 */
export function ensureTableOrderRoundDeadlineSweep(options?: {
  intervalMs?: number;
}): void {
  if (process.env.VERCEL) return;
  if (process.env.MESA_DISABLE_ROUND_DEADLINE_SWEEP === '1') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const g = globalThis as GlobalDeadlineRuntime;
  if (g.__mesaRoundDeadlineSweepStarted) return;
  g.__mesaRoundDeadlineSweepStarted = true;

  const intervalMs = Math.max(5_000, options?.intervalMs ?? SWEEP_INTERVAL_MS);
  const tick = () => {
    void (async () => {
      try {
        const admin = createAdminClient();
        const result = await sweepDueTableOrderRoundSubmits(admin);
        if (result.settled > 0 || result.errors > 0) {
          console.info('[mesa sushi-round] deadline sweep:', result);
        }
      } catch (e) {
        console.error('[mesa sushi-round] deadline sweep failed:', e);
      }
    })();
  };

  setTimeout(tick, 1_500);
  setInterval(tick, intervalMs);
}
