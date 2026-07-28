/** App appearance preference — one storage key, one DOM attribute (`data-theme`). */

export type ThemeMode = 'dark' | 'light';

export const MESA_THEME_STORAGE_KEY = 'mesa-theme';
export const DEFAULT_THEME: ThemeMode = 'light';

export function parseThemeMode(value: string | null | undefined): ThemeMode | null {
  return value === 'dark' || value === 'light' ? value : null;
}

/** Apply theme to the document. Safe only in the browser. */
export function applyDocumentTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function readStoredTheme(): ThemeMode | null {
  try {
    return parseThemeMode(localStorage.getItem(MESA_THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistTheme(theme: ThemeMode): void {
  localStorage.setItem(MESA_THEME_STORAGE_KEY, theme);
}

/** Inline bootstrap for `layout.tsx` — keep in sync with `readStoredTheme` / `DEFAULT_THEME`. */
export function buildThemeInitScript(): string {
  return `(() => {
  const key = ${JSON.stringify(MESA_THEME_STORAGE_KEY)};
  const fallback = ${JSON.stringify(DEFAULT_THEME)};
  let theme = fallback;
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'dark' || saved === 'light') theme = saved;
  } catch {}
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
})();`;
}
