import { NextResponse } from 'next/server';
import { liveHealthBody } from '@/lib/ops-health';

/** Docker / install / upgrade liveness probe. No auth. */
export async function GET() {
  return NextResponse.json(liveHealthBody(), {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
