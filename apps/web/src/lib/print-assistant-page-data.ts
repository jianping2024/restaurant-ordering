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
import { getPrintAgentDevicesBundle } from '@/lib/print-agent-devices-bundle';
import { loadPrintAgentPairings, type PrintAgentPairingListItem } from '@/lib/print-agent-pairings-server';
import {
  presentReceiptPrintersForCheckout,
  type ReceiptPrinterOption,
} from '@/lib/print-receipt-printer-options';
import type { ReceiptPrinterRoutingSnapshot } from '@/lib/print-receipt-printer-options';
import type { UILanguage } from '@/lib/i18n';

export type PrintAssistantUpperData = {
  devices: PrintAgentDeviceHeartbeatRow[];
  pairings: PrintAgentPairingListItem[];
};

export type PrintAssistantLowerData = {
  scheduleForm: PrintAgentSettingsForm;
  defaultReceiptStationId: string;
  receiptPrinters: ReceiptPrinterOption[];
};

function uiLangToReceiptLocale(lang: UILanguage): 'pt' | 'en' | 'zh' {
  if (lang === 'zh') return 'zh';
  if (lang === 'en') return 'en';
  return 'pt';
}

async function loadReceiptPrinterOptionsFromSnapshot(
  admin: SupabaseClient,
  restaurantId: string,
  snapshot: ReceiptPrinterRoutingSnapshot | null,
  lang: UILanguage,
): Promise<ReceiptPrinterOption[]> {
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

/** Devices + pairings for print-assistant upper panels (single device query via bundle). */
export async function loadPrintAssistantUpperData(
  restaurantId: string,
): Promise<PrintAssistantUpperData> {
  const [bundle, pairings] = await Promise.all([
    getPrintAgentDevicesBundle(restaurantId),
    loadPrintAgentPairings(),
  ]);

  return {
    devices: bundle.devices,
    pairings,
  };
}

/** Schedule, receipt printers, and defaults for deferred lower panels. */
export async function loadPrintAssistantLowerData(
  restaurantId: string,
  lang: UILanguage,
): Promise<PrintAssistantLowerData> {
  const admin = createAdminClient();
  const [config, bundle] = await Promise.all([
    loadPrintAgentConfig(admin, restaurantId),
    getPrintAgentDevicesBundle(restaurantId),
  ]);

  const receiptPrinters = await loadReceiptPrinterOptionsFromSnapshot(
    admin,
    restaurantId,
    bundle.receiptSnapshot,
    lang,
  );

  return {
    scheduleForm: config.scheduleForm,
    defaultReceiptStationId: config.defaultReceiptStationId,
    receiptPrinters,
  };
}
