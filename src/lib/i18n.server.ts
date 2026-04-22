import { cookies } from 'next/headers';
import { DEFAULT_UI_LANG, isUILanguage, type UILanguage, UI_LANG_COOKIE } from './i18n';

export async function getServerLanguage(): Promise<UILanguage> {
  const cookieStore = await cookies();
  const value = cookieStore.get(UI_LANG_COOKIE)?.value;
  return isUILanguage(value) ? value : DEFAULT_UI_LANG;
}
