import { NextResponse } from 'next/server';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  addTablesToParty,
  createTablePartyGroup,
  dissolveTablePartyGroup,
  loadTablePartyGroups,
  removeTableFromParty,
  renameTablePartyGroup,
} from '@/lib/table-party-groups-server';

export const runtime = 'nodejs';

type PartyActionBody = {
  action?: unknown;
  party_id?: unknown;
  table_id?: unknown;
  table_ids?: unknown;
  name?: unknown;
  confirm_move?: unknown;
};

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await openTableAuthFromRequest(req, slug);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const loaded = await loadTablePartyGroups(admin, ctx.restaurant_id);
  return NextResponse.json(loaded);
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await openTableAuthFromRequest(req, slug);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: PartyActionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const action = body.action;
  let result;
  if (action === 'create') {
    result = await createTablePartyGroup(admin, ctx.restaurant_id, body.name);
  } else if (action === 'rename') {
    result = await renameTablePartyGroup(
      admin,
      ctx.restaurant_id,
      body.party_id,
      body.name,
    );
  } else if (action === 'dissolve') {
    result = await dissolveTablePartyGroup(admin, ctx.restaurant_id, body.party_id);
  } else if (action === 'add_tables') {
    result = await addTablesToParty(
      admin,
      ctx.restaurant_id,
      body.party_id,
      body.table_ids,
      body.confirm_move === true,
    );
  } else if (action === 'remove_table') {
    result = await removeTableFromParty(
      admin,
      ctx.restaurant_id,
      body.party_id,
      body.table_id,
    );
  } else {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.conflicts ? { conflicts: result.conflicts } : {}),
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    parties: result.parties,
    partyMembers: result.partyMembers,
    ...(result.createdPartyId ? { created_party_id: result.createdPartyId } : {}),
  });
}
