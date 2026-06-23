'use client';

import { useThemeMode } from '@/components/providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeMode();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="h-8 w-8 rounded-full border border-brand-border bg-brand-bg text-sm text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
      title={isDark ? '切换到白天主题' : '切换到夜间主题'}
      aria-label={isDark ? '切换到白天主题' : '切换到夜间主题'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
