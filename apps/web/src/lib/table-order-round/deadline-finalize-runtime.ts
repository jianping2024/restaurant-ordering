import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  settleDueTableOrderRoundSubmit,
  sweepDueTableOrderRoundSubmits,
} from '@/lib/table-order-round/service';

const ARM_SLACK_MS = 250;
const SWEEP_INTERVAL_MS = 10_000;

type ArmKey = string;

type GlobalDeadlineRuntime = typeof globalThis & {
  __mesaRoundDeadlineArms?: Map<ArmKey, ReturnType<typeof setTimeout>>;
  __mesaRoundDeadlineSweepStarted?: boolean;
};

function arms(): Map<ArmKey, ReturnType<typeof setTimeout>> {
  const g = globalThis as GlobalDeadlineRuntime;
  if (!g.__mesaRoundDeadlineArms) g.__mesaRoundDeadlineArms = new Map();
  return g.__mesaRoundDeadlineArms;
}

/**
 * Exact-deadline arm after submit-request. Long-lived Node (on-prem / next dev) keeps
 * the timer even if every phone leaves. Do not add a second Vercel cron for this.
 * Lazy-starts the in-process safety sweep (no instrumentation.ts — avoids crypto bundle issues).
 */
export function armTableOrderRoundDeadlineFinalize(input: {
  roundId: string;
  restaurantId: string;
  sessionId: string;
  submitDeadlineAt: string;
}): void {
  ensureTableOrderRoundDeadlineSweep();

  const dueAt = Date.parse(input.submitDeadlineAt);
  if (!Number.isFinite(dueAt)) return;

  const map = arms();
  const prev = map.get(input.roundId);
  if (prev) clearTimeout(prev);

  const delay = Math.max(0, dueAt - Date.now()) + ARM_SLACK_MS;
  const timer = setTimeout(() => {
    map.delete(input.roundId);
    void (async () => {
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
    })();
  }, delay);
  map.set(input.roundId, timer);
}

/**
 * In-process safety sweep. Idempotent via globalThis.
 * Start from API Node routes (submit-request / GET round) — not instrumentation.
 */
export function ensureTableOrderRoundDeadlineSweep(options?: {
  intervalMs?: number;
}): void {
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
