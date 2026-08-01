import { NextResponse } from 'next/server';
import {
  checkInOnPremInstallation,
  resolveLicenseLeaseSecret,
} from '@/lib/license-control';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * On-prem instance → platform. Auth = Bearer check-in credential.
 */
export async function POST(req: Request) {
  const leaseSecret = resolveLicenseLeaseSecret();
  if (!leaseSecret) {
    return NextResponse.json({ error: 'lease_secret_unconfigured' }, { status: 503 });
  }

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  let bodyCredential = '';
  try {
    const body = (await req.json()) as { checkinCredential?: string };
    bodyCredential = typeof body.checkinCredential === 'string' ? body.checkinCredential : '';
  } catch {
    // body optional when using Bearer
  }
  const checkinCredential = bearer || bodyCredential;

  const admin = createAdminClient();
  const result = await checkInOnPremInstallation(admin, {
    checkinCredential,
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
    licenseValidUntil: result.licenseValidUntil,
    leaseToken: result.leaseToken,
    lease: result.lease,
    desiredSuspended: result.desiredSuspended,
    dailyBusinessReportEnabled: result.dailyBusinessReportEnabled,
  });
}
