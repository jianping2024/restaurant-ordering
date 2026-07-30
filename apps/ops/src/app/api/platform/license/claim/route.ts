import { NextResponse } from 'next/server';
import {
  claimOnPremInstallation,
  resolveLicenseLeaseSecret,
} from '@/lib/license-control';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * On-prem installer → platform. Auth = one-time install code (not ops session).
 */
export async function POST(req: Request) {
  const leaseSecret = resolveLicenseLeaseSecret();
  if (!leaseSecret) {
    return NextResponse.json({ error: 'lease_secret_unconfigured' }, { status: 503 });
  }

  let body: { code?: string; ownerPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await claimOnPremInstallation(admin, {
    code: body.code || '',
    ownerPassword: body.ownerPassword || '',
    leaseSecret,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    restaurantId: result.restaurantId,
    slug: result.slug,
    ownerEmail: result.ownerEmail,
    checkinCredential: result.checkinCredential,
    licenseValidUntil: result.licenseValidUntil,
    leaseToken: result.leaseToken,
    lease: result.lease,
  });
}
