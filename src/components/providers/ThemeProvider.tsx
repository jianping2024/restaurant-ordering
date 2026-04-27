'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'mesa-theme';
const DEFAULT_THEME: ThemeMode = 'light';

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'dark' || attr === 'light' ? attr : DEFAULT_THEME;
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial: ThemeMode = saved === 'dark' || saved === 'light' ? saved : DEFAULT_THEME;
    setThemeState(initial);
    applyTheme(initial);
    document.documentElement.style.colorScheme = initial;
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme: (next: ThemeMode) => {
      setThemeState(next);
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      document.documentElement.style.colorScheme = next;
    },
    toggleTheme: () => {
      const next = theme === 'dark' ? 'light' : 'dark';
      setThemeState(next);
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      document.documentElement.style.colorScheme = next;
    },
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
