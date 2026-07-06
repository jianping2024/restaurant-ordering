'use client';

import { useThemeMode } from '@/components/providers/ThemeProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

type Props = {
  variant?: 'icon' | 'row';
};

export function ThemeToggle({ variant = 'icon' }: Props) {
  const { theme, toggleTheme } = useThemeMode();
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const isDark = theme === 'dark';

  if (variant === 'row') {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm text-brand-text">
          <span aria-hidden className="shrink-0 text-base leading-none">
            🌙
          </span>
          <span>{t.darkMode}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={t.darkMode}
          onClick={toggleTheme}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
            isDark
              ? 'border-brand-gold/50 bg-brand-gold'
              : 'border-brand-border bg-brand-bg'
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-0.5 left-0.5 h-[1.125rem] w-[1.125rem] rounded-full bg-brand-card shadow-sm transition-transform ${
              isDark ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="h-9 w-9 shrink-0 rounded-full border border-brand-border bg-brand-bg text-sm text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
      title={isDark ? '切换到白天主题' : '切换到夜间主题'}
      aria-label={isDark ? '切换到白天主题' : '切换到夜间主题'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
