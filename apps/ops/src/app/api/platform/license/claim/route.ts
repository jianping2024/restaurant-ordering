import { NextResponse } from 'next/server';
import {
  claimOnPremInstallation,
  resolveLicenseLeaseSecret,
} from '@/lib/license-control';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * On-prem installer → platform. Auth = one-time install code (not ops session).
 * Does not create platform Auth — local /setup apply-claim creates the store owner.
 */
export async function POST(req: Request) {
  const leaseSecret = resolveLicenseLeaseSecret();
  if (!leaseSecret) {
    return NextResponse.json({ error: 'lease_secret_unconfigured' }, { status: 503 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await claimOnPremInstallation(admin, {
    code: body.code || '',
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
    name: result.name,
    slug: result.slug,
    ownerEmail: result.ownerEmail,
    printLocale: result.printLocale,
    countryCode: result.countryCode,
    buffetServiceMode: result.buffetServiceMode,
    checkinCredential: result.checkinCredential,
    /** Store persists this into license-state; pack must not ship it. */
    leaseSecret,
    licenseValidUntil: result.licenseValidUntil,
    suspendedAt: result.suspendedAt,
    suspensionReason: result.suspensionReason,
    leaseToken: result.leaseToken,
    lease: result.lease,
  });
}
