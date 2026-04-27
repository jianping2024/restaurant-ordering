import { cookies } from 'next/headers';
import { DEFAULT_UI_LANG, isUILanguage, type UILanguage, UI_LANG_COOKIE } from './i18n';

/** 与 RootLayout / LanguageProvider 对齐：hydration 与客户端恢复 localStorage 都依赖该结构 */
export type ServerUILanguageBootstrap = {
  initialLang: UILanguage;
  /** 请求是否带有 mesa-ui-lang（与值是否合法无关）；false 时才允许用 localStorage 覆盖默认语言 */
  languageCookiePresent: boolean;
};

export async function getServerUILanguageBootstrap(): Promise<ServerUILanguageBootstrap> {
  const cookieStore = await cookies();
  const entry = cookieStore.get(UI_LANG_COOKIE);
  const value = entry?.value;
  return {
    initialLang: isUILanguage(value) ? value : DEFAULT_UI_LANG,
    languageCookiePresent: entry !== undefined,
  };
}

export async function getServerLanguage(): Promise<UILanguage> {
  const { initialLang } = await getServerUILanguageBootstrap();
  return initialLang;
}
