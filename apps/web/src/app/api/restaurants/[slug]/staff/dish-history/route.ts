import { NextResponse } from 'next/server';
import { listDishHistory } from '@/lib/dish-history-server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_UI_LANG, isUILanguage } from '@/lib/i18n';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(req, slug, 'dashboard.dish_history.view');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const url = new URL(req.url);
  const langRaw = url.searchParams.get('lang');
  const result = await listDishHistory({
    admin,
    restaurantId: ctx.restaurant_id,
    q: url.searchParams.get('q'),
    pageRaw: url.searchParams.get('page'),
    pageSizeRaw: url.searchParams.get('page_size'),
    lang: isUILanguage(langRaw) ? langRaw : DEFAULT_UI_LANG,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.message ? { message: result.message } : {}) },
      { status: result.status },
    );
  }

  return NextResponse.json({
    items: result.items,
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  });
}
