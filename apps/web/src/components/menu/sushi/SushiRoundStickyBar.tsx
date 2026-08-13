'use client';

import { useEffect, useState } from 'react';
import type { RoundSnapshot } from '@/lib/table-order-round/types';
import { isCooldownActive, isDeferCooldownActive } from '@/lib/table-order-round/status';
import type { SUSHI_ROUND_MESSAGES } from '@/lib/i18n/sushi-round-messages';
import type { Language } from '@/types';

type Copy = (typeof SUSHI_ROUND_MESSAGES)[Language];

function secondsUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

export function SushiRoundStickyBar({
  snapshot,
  labels,
}: {
  snapshot: RoundSnapshot;
  labels: Copy;
}) {
  const [, setTick] = useState(0);
  const round = snapshot.round;
  const needsTick =
    round?.status === 'pending_confirm' ||
    (round?.status === 'cooldown' && isCooldownActive(round.status, round.cooldown_until)) ||
    isDeferCooldownActive(round?.defer_cooldown_until ?? null);

  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  const guests = snapshot.live_guest_count;
  const cap = snapshot.round_cap_total;
  const qty = snapshot.lines_qty_total;
  const confirmed = snapshot.votes.filter((v) => v.vote === 'confirm').length;
  const quorum = round?.guest_count_snapshot ?? guests;

  let statusLine: string | null = null;
  if (round?.status === 'pending_confirm') {
    statusLine = labels.stickyPending
      .replace('{confirmed}', String(confirmed))
      .replace('{quorum}', String(quorum))
      .replace('{seconds}', String(secondsUntil(round.submit_deadline_at)));
  } else if (round?.status === 'cooldown' && isCooldownActive(round.status, round.cooldown_until)) {
    statusLine = labels.stickyCooldown.replace(
      '{seconds}',
      String(secondsUntil(round.cooldown_until)),
    );
  } else if (isDeferCooldownActive(round?.defer_cooldown_until ?? null)) {
    statusLine = labels.stickyDeferCooldown.replace(
      '{seconds}',
      String(secondsUntil(round?.defer_cooldown_until)),
    );
  } else if (qty > 0) {
    statusLine = labels.stickyRoundProgress
      .replace('{qty}', String(qty))
      .replace('{cap}', String(cap));
  }

  return (
    <div className="sticky top-0 z-20 border-b border-brand-border bg-brand-card/95 px-4 py-2 backdrop-blur-sm">
      <p className="text-[13px] text-brand-text">
        {labels.stickyGuestsCap
          .replace('{guests}', String(guests))
          .replace('{cap}', String(cap || guests * (round?.per_person_cap ?? 8)))}
      </p>
      {statusLine ? (
        <p className="mt-0.5 text-[12px] tabular-nums text-brand-text-muted">{statusLine}</p>
      ) : null}
    </div>
  );
}
