/** User-facing product name (web, ops console, print-agent UI). */
export const PRODUCT_NAME = 'MesaGo';

export const OPS_CONSOLE_NAME = `${PRODUCT_NAME} Ops`;

export const PRINT_AGENT_NAME = `${PRODUCT_NAME} Print Agent`;

/** Windows tray icon label (English UI in print agent). */
export const PRINT_AGENT_TRAY_TITLE = `${PRODUCT_NAME} Print`;

export const PRODUCT_TAGLINE_ZH = '葡萄牙餐厅点餐系统';

export const PRODUCT_SITE_DESCRIPTION_ZH =
  '多租户餐厅 SaaS，支持扫码点餐、实时厨房显示、智能分单';

export const PRODUCT_SITE_TITLE = `${PRODUCT_NAME} — ${PRODUCT_TAGLINE_ZH}`;

/** Localized print-assistant product label for dashboard copy. */
export function printAgentLabel(lang: 'zh' | 'en' | 'pt'): string {
  return lang === 'zh' ? `${PRODUCT_NAME} 打印助手` : PRINT_AGENT_NAME;
}
