import type { Language } from '@/types';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { showToast } from '@/components/ui/Toast';

const SILENT_ERRORS = new Set(['nothing_enqueued']);

type PrintEnqueueMessages = (typeof MENU_PAGE_MESSAGES)[Language];

function messageForError(code: string, t: PrintEnqueueMessages): string {
  if (code === 'no_station_bound_lines') return t.printEnqueueNoStation;
  if (code === 'rate_limited' || code === 'invalid_enqueue_token') return t.printEnqueueRateLimited;
  if (code === 'order_not_found' || code === 'unknown_batch') return t.printEnqueueFailed;
  return t.printEnqueueFailed;
}

/** After order submit: enqueue station tickets; toast on waiter flow when action is needed. */
export async function autoEnqueueStationTicketsAfterSubmit(params: {
  slug: string;
  orderId: string;
  batchId: string;
  enqueueToken: string;
  waiterFlow: boolean;
  lang: Language;
}): Promise<void> {
  const { slug, orderId, batchId, enqueueToken, waiterFlow, lang } = params;
  const t = MENU_PAGE_MESSAGES[lang];

  try {
    const res = await fetch(`/api/restaurants/${slug}/station-tickets/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        batch_id: batchId,
        enqueue_token: enqueueToken,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (res.ok) return;

    const code = typeof data.error === 'string' ? data.error : '';
    if (SILENT_ERRORS.has(code)) return;
    if (!waiterFlow) return;

    showToast(messageForError(code, t), code === 'no_station_bound_lines' ? 'info' : 'error');
  } catch {
    if (waiterFlow) showToast(t.printEnqueueFailed, 'error');
  }
}
