import { NextResponse } from 'next/server';
import { applyOnPremClaim, type PlatformClaimSnapshot } from '@/lib/license-materialize';
import { createAdminClient } from '@/lib/supabase/admin';
import { accountPasswordPolicyError } from '@/lib/auth/account-password-policy';

/**
 * On-prem /setup: platform claim (code) + local apply-claim (owner password).
 * Pack pre-configures only MESA_PLATFORM_LICENSE_URL; checkinCredential + leaseSecret
 * come from the platform claim response and are persisted to license-state.
 * Does not create a session — client redirects to /auth/login.
 */
export async function POST(req: Request) {
  let body: { code?: string; ownerPassword?: string; platformUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const code = (body.code || '').trim();
  const ownerPassword = body.ownerPassword || '';
  const platformUrl = (
    body.platformUrl?.trim() ||
    process.env.MESA_PLATFORM_LICENSE_URL?.trim() ||
    ''
  ).replace(/\/$/, '');

  if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });
  const passwordError = accountPasswordPolicyError(ownerPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }
  if (!platformUrl) {
    return NextResponse.json({ error: 'platform_url_required' }, { status: 400 });
  }

  let claimRes: Response;
  try {
    claimRes = await fetch(`${platformUrl}/api/platform/license/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: 'platform_unreachable',
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  const claimJson = (await claimRes.json()) as PlatformClaimSnapshot & {
    ok?: boolean;
    error?: string;
    detail?: string;
    leaseSecret?: string;
  };
  const leaseSecret =
    typeof claimJson.leaseSecret === 'string' ? claimJson.leaseSecret.trim() : '';
  if (
    !claimRes.ok ||
    !claimJson.restaurantId ||
    !claimJson.checkinCredential ||
    !claimJson.leaseToken ||
    !leaseSecret
  ) {
    return NextResponse.json(
      {
        error: claimJson.error || (leaseSecret ? 'claim_failed' : 'lease_secret_missing'),
        detail: claimJson.detail,
      },
      { status: claimRes.status >= 400 ? claimRes.status : 502 },
    );
  }

  if (!claimJson.lease?.server_time || !claimJson.lease?.lease_until) {
    return NextResponse.json({ error: 'invalid_claim_snapshot' }, { status: 502 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const applied = await applyOnPremClaim(admin, {
    snapshot: {
      restaurantId: claimJson.restaurantId,
      name: claimJson.name,
      slug: claimJson.slug,
      ownerEmail: claimJson.ownerEmail,
      printLocale: claimJson.printLocale,
      countryCode: claimJson.countryCode,
      buffetServiceMode: claimJson.buffetServiceMode,
      checkinCredential: claimJson.checkinCredential,
      licenseValidUntil: claimJson.licenseValidUntil ?? null,
      suspendedAt: claimJson.suspendedAt ?? null,
      suspensionReason: claimJson.suspensionReason ?? null,
      leaseToken: claimJson.leaseToken,
      lease: claimJson.lease,
    },
    ownerPassword,
    platformConfig: {
      platformUrl,
      checkinCredential: claimJson.checkinCredential,
      leaseSecret,
    },
  });

  if (!applied.ok) {
    return NextResponse.json(
      { error: applied.error, detail: applied.detail },
      { status: applied.status },
    );
  }

  return NextResponse.json({
    ok: true,
    restaurantId: applied.restaurantId,
    ownerEmail: applied.ownerEmail,
    slug: applied.slug,
    redirectTo: '/auth/login',
  });
}
