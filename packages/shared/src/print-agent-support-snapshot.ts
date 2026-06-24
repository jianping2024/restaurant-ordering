import type { SupabaseClient } from '@supabase/supabase-js';

export type PrintAgentSupportSnapshot = {
  device: {
    id: string;
    label: string | null;
    pairedAt: string;
    validUntil: string;
    revokedAt: string | null;
    lastSeen: string | null;
    agentVersion: string | null;
    lastPrintAt: string | null;
    lastPrintStatus: string | null;
  };
  restaurant: {
    id: string;
    name: string;
    slug: string;
    printLocale: string;
    countryCode: string;
  };
  printAgentConfig: Record<string, unknown>;
  supabaseUrl: string | null;
};

export async function consumePrintAgentSupportToken(
  admin: SupabaseClient,
  jti: string,
  expected: { deviceId: string; restaurantId: string },
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('print_agent_support_tokens')
    .update({ consumed_at: now })
    .eq('id', jti)
    .eq('device_id', expected.deviceId)
    .eq('restaurant_id', expected.restaurantId)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('id')
    .maybeSingle();

  return !error && Boolean(data);
}

export async function loadPrintAgentSupportSnapshot(
  admin: SupabaseClient,
  deviceId: string,
  restaurantId: string,
  options?: { supabaseUrl?: string | null },
): Promise<PrintAgentSupportSnapshot | null> {
  const [{ data: device }, { data: restaurant }] = await Promise.all([
    admin
      .from('print_agent_devices')
      .select(
        'id, label, paired_at, valid_until, revoked_at, last_seen, agent_version, last_print_at, last_print_status',
      )
      .eq('id', deviceId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle(),
    admin
      .from('restaurants')
      .select('id, name, slug, print_locale, country_code, print_agent_config')
      .eq('id', restaurantId)
      .maybeSingle(),
  ]);

  if (!device || !restaurant) return null;

  const rawConfig = restaurant.print_agent_config;
  const printAgentConfig =
    rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
      ? (rawConfig as Record<string, unknown>)
      : {};

  return {
    device: {
      id: device.id,
      label: device.label,
      pairedAt: device.paired_at,
      validUntil: device.valid_until,
      revokedAt: device.revoked_at,
      lastSeen: device.last_seen,
      agentVersion: device.agent_version,
      lastPrintAt: device.last_print_at,
      lastPrintStatus: device.last_print_status,
    },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      printLocale: restaurant.print_locale ?? 'pt',
      countryCode: restaurant.country_code ?? 'PT',
    },
    printAgentConfig,
    supabaseUrl: options?.supabaseUrl ?? null,
  };
}
