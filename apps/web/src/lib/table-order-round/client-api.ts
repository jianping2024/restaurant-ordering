'use client';

/** Sole browser client for table-order-round HTTP APIs. */

import type { RoundSnapshot, TableOrderRoundLineRow } from '@/lib/table-order-round/types';
import type { SushiRoundSettings } from '@/lib/table-order-round/settings';

export type RoundApiSnapshot = RoundSnapshot & {
  ok?: boolean;
  finalized?: boolean;
  deferred?: boolean;
  enqueue_token?: string;
  order_id?: string;
  batch_id?: string;
  idempotent_replay?: boolean;
};

function parseSnapshot(json: unknown, fallbackSettings: SushiRoundSettings): RoundApiSnapshot | null {
  if (!json || typeof json !== 'object') return null;
  const raw = json as Record<string, unknown>;
  return {
    round: (raw.round as RoundSnapshot['round']) ?? null,
    lines: Array.isArray(raw.lines)
      ? (raw.lines as TableOrderRoundLineRow[]).map((line) => ({
          ...line,
          note: typeof line.note === 'string' ? line.note : '',
        }))
      : [],
    votes: Array.isArray(raw.votes) ? (raw.votes as RoundSnapshot['votes']) : [],
    settings:
      raw.settings && typeof raw.settings === 'object'
        ? (raw.settings as SushiRoundSettings)
        : fallbackSettings,
    live_guest_count: Number(raw.live_guest_count) || 0,
    round_cap_total: Number(raw.round_cap_total) || 0,
    lines_qty_total: Number(raw.lines_qty_total) || 0,
    ok: raw.ok === true,
    finalized: raw.finalized === true,
    deferred: raw.deferred === true,
    enqueue_token: typeof raw.enqueue_token === 'string' ? raw.enqueue_token : undefined,
    order_id: typeof raw.order_id === 'string' ? raw.order_id : undefined,
    batch_id: typeof raw.batch_id === 'string' ? raw.batch_id : undefined,
    idempotent_replay: raw.idempotent_replay === true,
  };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function fetchRoundSnapshot(params: {
  slug: string;
  tableId: string;
  guestClientId?: string | null;
  settings: SushiRoundSettings;
}): Promise<{ ok: true; snapshot: RoundApiSnapshot } | { ok: false; error: string; status: number }> {
  const qs = new URLSearchParams({ table_id: params.tableId });
  if (params.guestClientId) qs.set('guest_client_id', params.guestClientId);
  const res = await fetch(`/api/restaurants/${params.slug}/table-order-round?${qs.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  const json = await readJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: typeof json.error === 'string' ? json.error : 'fetch_failed',
      status: res.status,
    };
  }
  const snapshot = parseSnapshot(json, params.settings);
  if (!snapshot) return { ok: false, error: 'invalid_snapshot', status: 500 };
  return { ok: true, snapshot };
}

export async function upsertRoundLineClient(params: {
  slug: string;
  tableId: string;
  guestClientId: string;
  menuItemId: string;
  qty: number;
  note?: string | null;
  settings: SushiRoundSettings;
}): Promise<{ ok: true; snapshot: RoundApiSnapshot } | { ok: false; error: string; status: number }> {
  const res = await fetch(`/api/restaurants/${params.slug}/table-order-round/lines`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: params.tableId,
      guest_client_id: params.guestClientId,
      menu_item_id: params.menuItemId,
      qty: params.qty,
      note: params.note ?? '',
    }),
  });
  const json = await readJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: typeof json.error === 'string' ? json.error : 'upsert_failed',
      status: res.status,
    };
  }
  const snapshot = parseSnapshot(json, params.settings);
  if (!snapshot) return { ok: false, error: 'invalid_snapshot', status: 500 };
  return { ok: true, snapshot };
}

export async function deleteRoundLineClient(params: {
  slug: string;
  tableId: string;
  guestClientId: string;
  lineId: string;
  settings: SushiRoundSettings;
}): Promise<{ ok: true; snapshot: RoundApiSnapshot } | { ok: false; error: string; status: number }> {
  const qs = new URLSearchParams({
    table_id: params.tableId,
    guest_client_id: params.guestClientId,
    line_id: params.lineId,
  });
  const res = await fetch(`/api/restaurants/${params.slug}/table-order-round/lines?${qs.toString()}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const json = await readJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: typeof json.error === 'string' ? json.error : 'delete_failed',
      status: res.status,
    };
  }
  const snapshot = parseSnapshot(json, params.settings);
  if (!snapshot) return { ok: false, error: 'invalid_snapshot', status: 500 };
  return { ok: true, snapshot };
}

export async function submitRoundRequestClient(params: {
  slug: string;
  tableId: string;
  guestClientId: string;
  settings: SushiRoundSettings;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ ok: true; snapshot: RoundApiSnapshot } | { ok: false; error: string; status: number }> {
  const res = await fetch(`/api/restaurants/${params.slug}/table-order-round/submit-request`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: params.tableId,
      guest_client_id: params.guestClientId,
      latitude: params.latitude ?? undefined,
      longitude: params.longitude ?? undefined,
    }),
  });
  const json = await readJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: typeof json.error === 'string' ? json.error : 'submit_failed',
      status: res.status,
    };
  }
  const snapshot = parseSnapshot(json, params.settings);
  if (!snapshot) return { ok: false, error: 'invalid_snapshot', status: 500 };
  return { ok: true, snapshot };
}

export async function voteRoundClient(params: {
  slug: string;
  tableId: string;
  guestClientId: string;
  vote: 'confirm' | 'defer';
  settings: SushiRoundSettings;
}): Promise<{ ok: true; snapshot: RoundApiSnapshot } | { ok: false; error: string; status: number }> {
  const res = await fetch(`/api/restaurants/${params.slug}/table-order-round/vote`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: params.tableId,
      guest_client_id: params.guestClientId,
      vote: params.vote,
    }),
  });
  const json = await readJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: typeof json.error === 'string' ? json.error : 'vote_failed',
      status: res.status,
    };
  }
  const snapshot = parseSnapshot(json, params.settings);
  if (!snapshot) return { ok: false, error: 'invalid_snapshot', status: 500 };
  return { ok: true, snapshot };
}

export async function finalizeRoundClient(params: {
  slug: string;
  tableId: string;
  guestClientId: string;
  settings: SushiRoundSettings;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ ok: true; snapshot: RoundApiSnapshot } | { ok: false; error: string; status: number }> {
  const res = await fetch(`/api/restaurants/${params.slug}/table-order-round/finalize`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: params.tableId,
      guest_client_id: params.guestClientId,
      latitude: params.latitude ?? undefined,
      longitude: params.longitude ?? undefined,
    }),
  });
  const json = await readJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: typeof json.error === 'string' ? json.error : 'finalize_failed',
      status: res.status,
    };
  }
  const snapshot = parseSnapshot(json, params.settings);
  if (!snapshot) return { ok: false, error: 'invalid_snapshot', status: 500 };
  return { ok: true, snapshot };
}

/** Own-client qty for a menu item from round lines. */
export function ownLineQty(
  lines: TableOrderRoundLineRow[],
  menuItemId: string,
  guestClientId: string,
): number {
  const line = lines.find(
    (l) => l.menu_item_id === menuItemId && l.guest_client_id === guestClientId,
  );
  return line?.qty ?? 0;
}

export function ownLineNote(
  lines: TableOrderRoundLineRow[],
  menuItemId: string,
  guestClientId: string,
): string {
  return (
    lines.find((l) => l.menu_item_id === menuItemId && l.guest_client_id === guestClientId)?.note ??
    ''
  );
}

export function ownLinesQtyTotal(
  lines: TableOrderRoundLineRow[],
  guestClientId: string,
): number {
  return lines
    .filter((l) => l.guest_client_id === guestClientId)
    .reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
}

export function ownLineId(
  lines: TableOrderRoundLineRow[],
  menuItemId: string,
  guestClientId: string,
): string | null {
  return (
    lines.find((l) => l.menu_item_id === menuItemId && l.guest_client_id === guestClientId)?.id ??
    null
  );
}

