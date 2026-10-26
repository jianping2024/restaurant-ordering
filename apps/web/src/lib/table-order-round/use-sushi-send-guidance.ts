'use client';

import { useEffect, useState } from 'react';
import type { RoundSnapshot } from '@/lib/table-order-round/types';
import {
  resolveSushiSendGuidance,
  sushiSendGuidanceTicks,
  type SushiSendGuidance,
} from '@/lib/table-order-round/send-guidance';

/**
 * Sole live sushi send guidance for the page: one 1s local clock only while a
 * countdown / cooldown is shown (display tick, not an API poll).
 */
export function useSushiSendGuidance(input: {
  snapshot: RoundSnapshot;
  tableReviewQty: number;
}): SushiSendGuidance | null {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const round = input.snapshot.round;
  const guidance = resolveSushiSendGuidance({
    status: round?.status,
    cooldownUntil: round?.cooldown_until,
    submitDeadlineAt: round?.submit_deadline_at,
    tableReviewQty: input.tableReviewQty,
    roundCapTotal: input.snapshot.round_cap_total,
    nowMs,
  });
  const ticks = sushiSendGuidanceTicks(guidance);

  useEffect(() => {
    if (!ticks) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticks]);

  return guidance;
}
