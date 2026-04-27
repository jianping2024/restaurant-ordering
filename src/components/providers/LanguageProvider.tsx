'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_UI_LANG, isUILanguage, setClientLanguage, UI_LANG_COOKIE, type UILanguage } from '@/lib/i18n';

interface LanguageContextValue {
  lang: UILanguage;
  setLang: (lang: UILanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_UI_LANG,
  setLang: () => {},
});

/**
 * initialLang 须与 SSR 读取的 cookie 一致（见 getServerUILanguageBootstrap），避免 hydration mismatch。
 * languageCookiePresent：仅当请求未带 mesa-ui-lang 时，才在客户端用 localStorage 恢复偏好；
 * 否则必须以 cookie 为准（含用户明确选择中文），不能用「默认 zh」误判为「未设置」去覆盖 cookie。
 */
export function LanguageProvider({
  children,
  initialLang,
  languageCookiePresent,
}: {
  children: React.ReactNode;
  initialLang: UILanguage;
  languageCookiePresent: boolean;
}) {
  const [lang, setLangState] = useState<UILanguage>(initialLang);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(UI_LANG_COOKIE);
      if (!languageCookiePresent && isUILanguage(raw) && raw !== lang) {
        setLangState(raw);
        setClientLanguage(raw);
        return;
      }
      if (!isUILanguage(raw) || raw !== lang) {
        setClientLanguage(lang);
        return;
      }
      if (!languageCookiePresent) {
        setClientLanguage(lang);
      }
    } catch {
      setClientLanguage(lang);
    }
  }, [languageCookiePresent, lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang: (next: UILanguage) => {
        setLangState(next);
        setClientLanguage(next);
      },
    }),
    [lang],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
