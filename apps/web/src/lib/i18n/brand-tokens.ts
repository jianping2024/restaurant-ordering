import {
  OPS_CONSOLE_NAME,
  PRINT_AGENT_TRAY_TITLE,
  PRODUCT_NAME,
  printAgentLabel,
} from '@mesa/shared';
import type { UILanguage } from '@/lib/i18n';

export type BrandTokenKey = 'brand' | 'printAgent' | 'trayIcon' | 'opsConsole';

export function getBrandTokens(lang: UILanguage): Record<BrandTokenKey, string> {
  return {
    brand: PRODUCT_NAME,
    printAgent: printAgentLabel(lang),
    trayIcon: lang === 'zh' ? PRODUCT_NAME : PRINT_AGENT_TRAY_TITLE,
    opsConsole: OPS_CONSOLE_NAME,
  };
}

export function applyBrandTokens<T>(value: T, tokens: Record<BrandTokenKey, string>): T {
  if (typeof value === 'string') {
    let out: string = value;
    for (const [key, replacement] of Object.entries(tokens) as [BrandTokenKey, string][]) {
      out = out.replaceAll(`{${key}}`, replacement);
    }
    return out as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyBrandTokens(item, tokens)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = applyBrandTokens(nested, tokens);
    }
    return out as T;
  }
  return value;
}
