'use client';

import { useThemeMode } from '@/components/providers/ThemeProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { appearanceChromeButtonClass } from '@/lib/appearance-chrome';
import { getMessages } from '@/lib/i18n/messages';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeMode();
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={t.darkMode}
      title={t.darkMode}
      onClick={toggleTheme}
      className={appearanceChromeButtonClass('icon')}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
