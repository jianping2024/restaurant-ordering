import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  cloudConfigToForm,
  defaultPrintAgentCloudConfig,
  normalizePrintAgentCloudConfig,
  type PrintAgentSettingsForm,
} from '@/lib/print-agent-config';
import type { PrintAgentDeviceHeartbeatRow } from '@/lib/print-agent-heartbeat';
import { loadPrintAgentDevices } from '@/lib/print-agent-devices-server';
import { loadPrintAgentPairings, type PrintAgentPairingListItem } from '@/lib/print-agent-pairings-server';
import {
  presentReceiptPrintersForCheckout,
  type ReceiptPrinterOption,
} from '@/lib/print-receipt-printer-options';
import { loadRestaurantReceiptPrinterSnapshot } from '@/lib/restaurant-receipt-printers-server';
import type { UILanguage } from '@/lib/i18n';

export type PrintAssistantPageData = {
  scheduleForm: PrintAgentSettingsForm;
  defaultReceiptStationId: string;
  devices: PrintAgentDeviceHeartbeatRow[];
  pairings: PrintAgentPairingListItem[];
  receiptPrinters: ReceiptPrinterOption[];
};

function uiLangToReceiptLocale(lang: UILanguage): 'pt' | 'en' | 'zh' {
  if (lang === 'zh') return 'zh';
  if (lang === 'en') return 'en';
  return 'pt';
}

async function loadReceiptPrinterOptions(
  admin: SupabaseClient,
  restaurantId: string,
  lang: UILanguage,
): Promise<ReceiptPrinterOption[]> {
  const snapshot = await loadRestaurantReceiptPrinterSnapshot(admin, restaurantId);
  if (!snapshot) return [];

  const { data: stations } = await admin
    .from('print_stations')
    .select('id, name_pt, name_en, name_zh, sort_order')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return presentReceiptPrintersForCheckout(
    snapshot.receipt_printers,
    stations || [],
    uiLangToReceiptLocale(lang),
  );
}

async function loadPrintAgentConfig(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ scheduleForm: PrintAgentSettingsForm; defaultReceiptStationId: string }> {
  const defaults = {
    scheduleForm: cloudConfigToForm(defaultPrintAgentCloudConfig()),
    defaultReceiptStationId: '',
  };

  try {
    const { data: row } = await admin
      .from('restaurants')
      .select('print_agent_config')
      .eq('id', restaurantId)
      .single();
    const raw = row?.print_agent_config;
    if (!raw || typeof raw !== 'object' || Object.keys(raw as object).length === 0) {
      return defaults;
    }
    const config = normalizePrintAgentCloudConfig(raw);
    return {
      scheduleForm: cloudConfigToForm(config),
      defaultReceiptStationId: config.default_receipt_station_id || '',
    };
  } catch {
    return defaults;
  }
}

/** Parallel dashboard data for /dashboard/settings/print-assistant (no GitHub). */
export async function loadPrintAssistantPageData(
  restaurantId: string,
  lang: UILanguage,
): Promise<PrintAssistantPageData> {
  const admin = createAdminClient();
  const [config, devices, pairings, receiptPrinters] = await Promise.all([
    loadPrintAgentConfig(admin, restaurantId),
    loadPrintAgentDevices(restaurantId),
    loadPrintAgentPairings(),
    loadReceiptPrinterOptions(admin, restaurantId, lang),
  ]);

  return {
    scheduleForm: config.scheduleForm,
    defaultReceiptStationId: config.defaultReceiptStationId,
    devices,
    pairings,
    receiptPrinters,
  };
}
