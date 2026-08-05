'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import {
  DEFAULT_THEME,
  applyDocumentTheme,
  parseThemeMode,
  persistTheme,
  readStoredTheme,
  type ThemeMode,
} from '@/lib/theme';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Must match server HTML on first paint; inline script + useLayoutEffect sync before paint.
  const [theme, setThemeState] = useState<ThemeMode>(DEFAULT_THEME);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    persistTheme(next);
    applyDocumentTheme(next);
  }, []);

  useLayoutEffect(() => {
    const initial =
      readStoredTheme() ??
      parseThemeMode(document.documentElement.getAttribute('data-theme')) ??
      DEFAULT_THEME;
    setThemeState(initial);
    applyDocumentTheme(initial);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
