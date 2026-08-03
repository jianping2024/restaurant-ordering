import type { Language } from '@/types';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import { showToast } from '@/components/ui/Toast';
import { logJsonConsoleEvent } from '@/lib/json-console-log';

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
  clientRequestId?: string;
}): Promise<void> {
  const { slug, orderId, batchId, enqueueToken, waiterFlow, lang, clientRequestId } = params;
  const t = MENU_PAGE_MESSAGES[lang];

  logJsonConsoleEvent('order_append', 'enqueue_start', {
    client_request_id: clientRequestId,
    order_id: orderId,
    batch_id: batchId,
    slug,
    waiter_flow: waiterFlow,
  });

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
    if (res.ok) {
      logJsonConsoleEvent('order_append', 'enqueue_ok', {
        client_request_id: clientRequestId,
        order_id: orderId,
        batch_id: batchId,
        slug,
        waiter_flow: waiterFlow,
      });
      return;
    }

    const code = typeof data.error === 'string' ? data.error : '';
    logJsonConsoleEvent('order_append', 'enqueue_failed', {
      client_request_id: clientRequestId,
      order_id: orderId,
      batch_id: batchId,
      slug,
      waiter_flow: waiterFlow,
      error: code || `http_${res.status}`,
    });
    if (SILENT_ERRORS.has(code)) return;
    if (!waiterFlow) return;

    showToast(messageForError(code, t), code === 'no_station_bound_lines' ? 'info' : 'error');
  } catch {
    logJsonConsoleEvent('order_append', 'enqueue_network', {
      client_request_id: clientRequestId,
      order_id: orderId,
      batch_id: batchId,
      slug,
      waiter_flow: waiterFlow,
    });
    if (waiterFlow) showToast(t.printEnqueueFailed, 'error');
  }
}
