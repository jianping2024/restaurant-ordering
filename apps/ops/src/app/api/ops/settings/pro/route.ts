import { NextResponse } from 'next/server';
import { normalizePremiumKeys, PREMIUM_KEYS, type PremiumKey } from '@mesa/shared';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

const SETTINGS_ID = 'default';

export async function GET() {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { data, error: fetchError } = await admin
    .from('platform_pro_settings')
    .select('premium_keys, wechat_url, whatsapp_url, updated_at')
    .eq('id', SETTINGS_ID)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({
    premiumKeys: normalizePremiumKeys(data?.premium_keys),
    wechatUrl: data?.wechat_url ?? null,
    whatsappUrl: data?.whatsapp_url ?? null,
    updatedAt: data?.updated_at ?? null,
    catalog: PREMIUM_KEYS,
  });
}

export async function PATCH(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const metadata: Record<string, unknown> = {};

  if (body.premiumKeys !== undefined) {
    const keys = normalizePremiumKeys(body.premiumKeys);
    if (keys.length === 0) {
      return NextResponse.json({ error: 'premium_keys_required' }, { status: 400 });
    }
    updates.premium_keys = keys;
    metadata.premiumKeys = keys;
  }

  if (body.wechatUrl === null || typeof body.wechatUrl === 'string') {
    const wechatUrl =
      typeof body.wechatUrl === 'string' ? body.wechatUrl.trim() || null : null;
    updates.wechat_url = wechatUrl;
    metadata.wechatUrl = wechatUrl;
  }

  if (body.whatsappUrl === null || typeof body.whatsappUrl === 'string') {
    const whatsappUrl =
      typeof body.whatsappUrl === 'string' ? body.whatsappUrl.trim() || null : null;
    updates.whatsapp_url = whatsappUrl;
    metadata.whatsappUrl = whatsappUrl;
  }

  if (Object.keys(metadata).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const { error: upsertError } = await admin
    .from('platform_pro_settings')
    .upsert({ id: SETTINGS_ID, ...updates });

  if (upsertError) {
    return NextResponse.json({ error: 'update_failed', detail: upsertError.message }, { status: 500 });
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'platform_pro_settings.update',
    targetType: 'platform_pro_settings',
    targetId: SETTINGS_ID,
    metadata,
  });

  return NextResponse.json({ ok: true });
}
