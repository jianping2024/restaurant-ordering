export type AuthShellVariant = 'login' | 'change-password' | 'info';

export type AuthShellCopy = {
  title: string;
  subtitle?: string;
  contextLine?: string;
  securityNote?: string;
  forgotHint?: string;
};

export const AUTH_SHELL_VARIANTS: Record<
  AuthShellVariant,
  { showTrustBadges: boolean; showLanguageSwitcher: boolean }
> = {
  login: { showTrustBadges: true, showLanguageSwitcher: true },
  'change-password': { showTrustBadges: false, showLanguageSwitcher: false },
  info: { showTrustBadges: false, showLanguageSwitcher: true },
};
