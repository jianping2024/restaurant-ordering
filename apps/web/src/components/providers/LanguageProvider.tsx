'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { DEFAULT_UI_LANG, setClientLanguage, type UILanguage } from '@/lib/i18n';

interface LanguageContextValue {
  lang: UILanguage;
  setLang: (lang: UILanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_UI_LANG,
  setLang: () => {},
});

/** initialLang 须与 getServerLanguage()（cookie）一致，勿用 localStorage 做首屏初值，否则 hydration 会不一致。 */
export function LanguageProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang: UILanguage;
}) {
  const [lang, setLangState] = useState<UILanguage>(initialLang);

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
