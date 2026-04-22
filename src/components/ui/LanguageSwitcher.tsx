'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import type { UILanguage } from '@/lib/i18n';
import { useRouter } from 'next/navigation';

const OPTIONS: { id: UILanguage; label: string }[] = [
  { id: 'zh', label: '中' },
  { id: 'en', label: 'EN' },
  { id: 'pt', label: 'PT' },
];

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();
  const router = useRouter();

  return (
    <div className={`flex items-center gap-1 bg-brand-card border border-brand-border rounded-full p-1 ${compact ? '' : 'w-fit'}`}>
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => {
            if (option.id === lang) return;
            setLang(option.id);
            router.refresh();
          }}
          className={`px-2.5 py-1 rounded-full text-xs transition-all ${
            lang === option.id
              ? 'bg-brand-gold text-brand-bg font-semibold'
              : 'text-brand-text-muted hover:text-brand-text'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
