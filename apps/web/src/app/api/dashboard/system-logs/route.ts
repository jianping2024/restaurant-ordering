import { NextResponse } from 'next/server';
import { canAccessSystemLogs } from '@/lib/system-logs/access';
import {
  SystemLogQueryError,
  querySystemLogs,
} from '@/lib/system-logs/query-system-logs';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export const dynamic = 'force-dynamic';

function parseIso(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * On-prem backend-admin only. One-shot pull — no follow / polling.
 * Query: from, to (ISO), q (optional keyword).
 */
export async function GET(request: Request) {
  const loaded = await loadPrincipalWithCapabilities();
  if (!loaded) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!canAccessSystemLogs(loaded.principal)) {
    // Cloud / non-owner: not found so the surface does not exist off on-prem admin.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const from = parseIso(url.searchParams.get('from'));
  const to = parseIso(url.searchParams.get('to'));
  const q = (url.searchParams.get('q') || '').slice(0, 200);

  if (!from || !to) {
    return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
  }

  try {
    const result = await querySystemLogs({ from, to, q });
    return NextResponse.json({
      lines: result.lines,
      truncated: result.truncated,
      source: result.source,
    });
  } catch (err) {
    if (err instanceof SystemLogQueryError) {
      const status =
        err.code === 'invalid_range' || err.code === 'range_too_large' ? 400 : 503;
      return NextResponse.json({ error: err.code }, { status });
    }
    return NextResponse.json({ error: 'read_failed' }, { status: 503 });
  }
}
