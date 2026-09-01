import { NextResponse } from 'next/server';
import { getRestaurantFiscalPolicy, updateRestaurantFiscalPolicy } from '@mesa/shared';
import { requirePlatformAdminRole } from '@/lib/platform-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { error, admin } = await requirePlatformAdminRole('viewer');
  if (error || !admin) return error!;

  const { id: restaurantId } = await context.params;
  const policy = await getRestaurantFiscalPolicy(admin, restaurantId);
  if (!policy) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    fiscal_profile: policy.fiscalProfile,
    max_fiscal_terminals: policy.maxFiscalTerminals,
    terminals_used: policy.terminalsUsed,
  });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id: restaurantId } = await context.params;
  let body: { fiscal_profile?: string | null; max_fiscal_terminals?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = await updateRestaurantFiscalPolicy(admin, {
    restaurantId,
    fiscalProfile:
      body.fiscal_profile === null
        ? null
        : body.fiscal_profile === 'restaurant' || body.fiscal_profile === 'retail'
          ? body.fiscal_profile
          : undefined,
    maxFiscalTerminals: body.max_fiscal_terminals,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status });
  }

  const policy = await getRestaurantFiscalPolicy(admin, restaurantId);
  return NextResponse.json({
    fiscal_profile: policy?.fiscalProfile ?? null,
    max_fiscal_terminals: policy?.maxFiscalTerminals ?? 1,
    terminals_used: policy?.terminalsUsed ?? 0,
  });
}
