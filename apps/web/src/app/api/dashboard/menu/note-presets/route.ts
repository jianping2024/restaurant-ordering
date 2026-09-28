import { NextResponse } from 'next/server';
import {
  loadWritableOperationalContext,
  menuApiError,
  readJsonBody,
} from '@/lib/dashboard-menu-api';
import {
  createMenuNotePreset,
  deleteMenuNotePreset,
  parseNotePresetNameBody,
  reorderMenuNotePresets,
  updateMenuNotePreset,
} from '@/lib/menu-note-presets-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const fields = parseNotePresetNameBody(body);
  if ('error' in fields) return menuApiError(fields);

  const result = await createMenuNotePreset(
    ctx.admin,
    ctx.restaurantId,
    body.group_id,
    fields,
  );
  if ('error' in result) return menuApiError(result);
  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (body.action === 'reorder') {
    const result = await reorderMenuNotePresets(
      ctx.admin,
      ctx.restaurantId,
      body.group_id,
      body.ordered_ids,
    );
    if ('error' in result) return menuApiError(result);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.preset_id !== 'string') {
    return NextResponse.json({ error: 'invalid_note_preset_id' }, { status: 400 });
  }

  const hasNames =
    typeof body.name_en === 'string' ||
    typeof body.name_pt === 'string' ||
    typeof body.name_zh === 'string';

  if (hasNames) {
    const fields = parseNotePresetNameBody(body);
    if ('error' in fields) return menuApiError(fields);
    const result = await updateMenuNotePreset(ctx.admin, ctx.restaurantId, body.preset_id, {
      ...fields,
      ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
      ...(typeof body.group_id === 'string' ? { group_id: body.group_id } : {}),
    });
    if ('error' in result) return menuApiError(result);
    return NextResponse.json(result);
  }

  if (typeof body.active === 'boolean' || typeof body.group_id === 'string') {
    const result = await updateMenuNotePreset(ctx.admin, ctx.restaurantId, body.preset_id, {
      ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
      ...(typeof body.group_id === 'string' ? { group_id: body.group_id } : {}),
    });
    if ('error' in result) return menuApiError(result);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'invalid_note_preset_patch' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  if (typeof body.preset_id !== 'string') {
    return NextResponse.json({ error: 'invalid_note_preset_id' }, { status: 400 });
  }

  const result = await deleteMenuNotePreset(ctx.admin, ctx.restaurantId, body.preset_id, {
    confirmUnbind: body.confirm_unbind === true,
  });
  if ('error' in result) {
    return NextResponse.json(
      {
        error: result.error,
        referenced_item_count: result.referenced_item_count,
      },
      { status: result.status },
    );
  }
  return NextResponse.json(result);
}
