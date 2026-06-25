import { NextResponse } from 'next/server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';

export const runtime = 'nodejs';

/** Waiter staff cannot close tables — use frontdesk dashboard close instead. */
export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(req, slug, 'waiter');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ error: 'role_not_allowed' }, { status: 403 });
}
