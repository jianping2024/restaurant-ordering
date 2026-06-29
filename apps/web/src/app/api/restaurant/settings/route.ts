import { NextResponse } from 'next/server';
import { normalizeCountryCode, mergeGeoOrderRestrictionFlag, readGeoOrderRestrictionEnabled } from '@mesa/shared';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseOrderRadiusInput } from '@/lib/order-radius';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  const auth = await getOwnerRestaurantId({ requireWritable: true });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  const hasLat = typeof body.geo_latitude === 'string' && body.geo_latitude.trim() !== '';
  const hasLng = typeof body.geo_longitude === 'string' && body.geo_longitude.trim() !== '';
  if (hasLat !== hasLng) {
    return NextResponse.json({ error: 'geo_invalid' }, { status: 400 });
  }

  const latitude = hasLat ? Number(body.geo_latitude) : null;
  const longitude = hasLng ? Number(body.geo_longitude) : null;
  if (
    (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
  ) {
    return NextResponse.json({ error: 'geo_invalid' }, { status: 400 });
  }

  const radiusRaw =
    typeof body.order_radius_meters === 'string'
      ? body.order_radius_meters
      : typeof body.order_radius_meters === 'number'
        ? String(body.order_radius_meters)
        : '';
  const orderRadiusMeters = parseOrderRadiusInput(radiusRaw);
  if (orderRadiusMeters == null) {
    return NextResponse.json({ error: 'order_radius_invalid' }, { status: 400 });
  }

  let countryCode: string | undefined;
  if (body.countryCode !== undefined) {
    const normalized = normalizeCountryCode(
      typeof body.countryCode === 'string' ? body.countryCode : '',
    );
    if (!normalized) {
      return NextResponse.json({ error: 'invalid_country_code' }, { status: 400 });
    }
    countryCode = normalized;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: existing, error: loadErr } = await admin
    .from('restaurants')
    .select('feature_flags')
    .eq('id', auth.restaurantId)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  const hasCoordinates = latitude != null && longitude != null;
  const geoOrderRestrictionEnabled =
    typeof body.geo_order_restriction_enabled === 'boolean'
      ? body.geo_order_restriction_enabled
      : readGeoOrderRestrictionEnabled(existing.feature_flags, hasCoordinates);

  if (geoOrderRestrictionEnabled && !hasCoordinates) {
    return NextResponse.json({ error: 'geo_coords_required' }, { status: 400 });
  }

  const update = {
    name,
    address: typeof body.address === 'string' ? body.address.trim() || null : null,
    phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
    geo_latitude: latitude,
    geo_longitude: longitude,
    order_radius_meters: orderRadiusMeters,
    feature_flags: mergeGeoOrderRestrictionFlag(existing.feature_flags, geoOrderRestrictionEnabled),
    ...(countryCode !== undefined ? { country_code: countryCode } : {}),
  };

  const { error } = await admin.from('restaurants').update(update).eq('id', auth.restaurantId);

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    if (
      error.code === '23514' &&
      (error.message?.includes('restaurants_order_radius_meters_check') ?? false)
    ) {
      return NextResponse.json({ error: 'order_radius_invalid' }, { status: 400 });
    }
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
