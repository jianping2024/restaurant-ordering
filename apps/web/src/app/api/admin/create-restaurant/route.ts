import { NextResponse } from 'next/server';
import { OPS_CONSOLE_NAME } from '@mesa/shared';
import { getOpsAppUrl } from '@/lib/ops-app-url';

/** @deprecated Use MesaGo Ops `POST /api/ops/restaurants` (authenticated platform admin). */
export async function POST() {
  const opsUrl = getOpsAppUrl();
  return NextResponse.json(
    {
      error: 'deprecated',
      message: `Restaurant creation moved to ${OPS_CONSOLE_NAME}. Sign in at /ops and use POST /api/ops/restaurants.`,
      opsLoginUrl: opsUrl ? `${opsUrl}/ops/login` : null,
    },
    {
      status: 410,
      headers: {
        Deprecation: 'true',
        ...(opsUrl ? { Link: `<${opsUrl}/ops/login>; rel="alternate"` } : {}),
      },
    },
  );
}
