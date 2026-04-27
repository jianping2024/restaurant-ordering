import { cookies } from 'next/headers';
import { DEFAULT_UI_LANG, isUILanguage, type UILanguage, UI_LANG_COOKIE } from './i18n';

/**
 * 与 RootLayout 同步读取 cookie，保证 SSR 与客户端 initialLang 一致（避免 hydration 文案不一致）。
 * Next 14 的 cookies() 为同步；语言切换由 LanguageSwitcher 写 cookie + localStorage。
 */
export function getServerLanguage(): UILanguage {
  const value = cookies().get(UI_LANG_COOKIE)?.value;
  return isUILanguage(value) ? value : DEFAULT_UI_LANG;
}
