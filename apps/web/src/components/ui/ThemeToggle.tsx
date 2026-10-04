'use client';

import { useThemeMode } from '@/components/providers/ThemeProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { MoonIcon, SunIcon } from '@/components/ui/appearance-icons';
import { appearanceChromeButtonClass, appearanceChromeGlyphClass } from '@/lib/appearance-chrome';
import { getMessages } from '@/lib/i18n/messages';

type Props = {
  /** `segment` inside AppearanceChromeGroup; default standalone icon. */
  layout?: 'icon' | 'segment';
};

export function ThemeToggle({ layout = 'icon' }: Props) {
  const { theme, toggleTheme } = useThemeMode();
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const isDark = theme === 'dark';
  const glyphClass = appearanceChromeGlyphClass(layout);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={t.darkMode}
      title={t.darkMode}
      onClick={toggleTheme}
      className={appearanceChromeButtonClass(layout)}
    >
      {isDark ? <SunIcon className={glyphClass} /> : <MoonIcon className={glyphClass} />}
    </button>
  );
}
