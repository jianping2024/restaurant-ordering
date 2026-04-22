'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { DEFAULT_UI_LANG, getClientLanguage, setClientLanguage, type UILanguage } from '@/lib/i18n';

interface LanguageContextValue {
  lang: UILanguage;
  setLang: (lang: UILanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_UI_LANG,
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UILanguage>(() => getClientLanguage());

  const value = useMemo(() => ({
    lang,
    setLang: (next: UILanguage) => {
      setLangState(next);
      setClientLanguage(next);
    },
  }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
