import type { Language } from '@/types';
import { autoEnqueueStationTicketsAfterSubmit } from '@/lib/auto-enqueue-station-tickets';

/** Kitchen enqueue + guest session refresh — non-blocking after append success. */
export function scheduleMenuOrderPostSubmitEffects(params: {
  slug: string;
  orderId: string;
  batchId: string;
  enqueueToken: string;
  waiterFlow: boolean;
  lang: Language;
  sessionId?: string;
  refreshSession?: () => Promise<unknown>;
}): void {
  void autoEnqueueStationTicketsAfterSubmit({
    slug: params.slug,
    orderId: params.orderId,
    batchId: params.batchId,
    enqueueToken: params.enqueueToken,
    waiterFlow: params.waiterFlow,
    lang: params.lang,
  });

  if (!params.waiterFlow && params.sessionId && params.refreshSession) {
    void params.refreshSession().catch(() => {});
  }
}
