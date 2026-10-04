'use client';

import { LanguageSwitcherIconChrome } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  appearanceChromeGroupClass,
  appearanceChromeGroupDividerClass,
} from '@/lib/appearance-chrome';

/** Sole language + theme pair: one capsule (customer ordering header, auth shell). */
export function AppearanceChromeGroup() {
  return (
    <div className={appearanceChromeGroupClass}>
      <LanguageSwitcherIconChrome layout="segment" />
      <span className={appearanceChromeGroupDividerClass} aria-hidden />
      <ThemeToggle layout="segment" />
    </div>
  );
}
