import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** PIN staff sessions removed — use Supabase Auth staff accounts. */
export async function GET() {
  return NextResponse.json({ error: 'staff_pin_removed' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: 'staff_pin_removed' }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'staff_pin_removed' }, { status: 410 });
}
