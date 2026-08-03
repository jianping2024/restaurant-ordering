'use client';

import {
  WaiterTableDetailContentSkeleton,
  waiterDetailLayout,
} from '@/components/waiter/waiter-table-detail-ui';

/** Layout-stable route placeholder — same content skeleton as WaiterTableDetail cold slot. */
export default function DemoWaiterTableLoading() {
  return (
    <div className="min-h-screen space-y-4 bg-brand-bg p-4" aria-hidden>
      <div className={waiterDetailLayout.pageHeading}>
        <div className="h-8 w-48 animate-pulse rounded bg-brand-border/40" />
      </div>
      <WaiterTableDetailContentSkeleton label="" />
    </div>
  );
}
