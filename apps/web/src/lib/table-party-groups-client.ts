import type { TablePartyGroup, TablePartyGroupMember } from '@/lib/table-party-groups';

export type TablePartyMutationResponse = {
  parties: TablePartyGroup[];
  partyMembers: TablePartyGroupMember[];
};

export type TablePartyConflictResponse = {
  error: 'tables_in_other_party';
  conflicts: TablePartyGroupMember[];
};

async function requestPartyMutation(
  slug: string,
  body: Record<string, unknown>,
): Promise<
  | { ok: true; data: TablePartyMutationResponse }
  | { ok: false; status: number; error: string; conflicts?: TablePartyGroupMember[] }
> {
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/table-parties`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json.error === 'string' ? json.error : 'request_failed',
      conflicts: Array.isArray(json.conflicts)
        ? (json.conflicts as TablePartyGroupMember[])
        : undefined,
    };
  }
  return {
    ok: true,
    data: {
      parties: (json.parties || []) as TablePartyGroup[],
      partyMembers: (json.partyMembers || []) as TablePartyGroupMember[],
    },
  };
}

export function createWaiterTableParty(slug: string, name?: string) {
  return requestPartyMutation(slug, { action: 'create', ...(name ? { name } : {}) });
}

export function dissolveWaiterTableParty(slug: string, partyId: string) {
  return requestPartyMutation(slug, { action: 'dissolve', party_id: partyId });
}

export function addTablesToWaiterTableParty(
  slug: string,
  partyId: string,
  tableIds: string[],
  confirmMove = false,
) {
  return requestPartyMutation(slug, {
    action: 'add_tables',
    party_id: partyId,
    table_ids: tableIds,
    confirm_move: confirmMove,
  });
}

export function removeTableFromWaiterTableParty(
  slug: string,
  partyId: string,
  tableId: string,
) {
  return requestPartyMutation(slug, {
    action: 'remove_table',
    party_id: partyId,
    table_id: tableId,
  });
}
