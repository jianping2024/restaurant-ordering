import { NextResponse } from 'next/server';
import { checkReadyHealth } from '@/lib/ops-health';

/** Install / upgrade readiness probe (Supabase reachable). No auth. */
export async function GET() {
  const result = await checkReadyHealth();
  return NextResponse.json(result.body, {
    status: result.httpStatus,
    headers: { 'Cache-Control': 'no-store' },
  });
}
