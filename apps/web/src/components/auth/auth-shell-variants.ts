export type AuthShellVariant = 'login' | 'change-password' | 'info';

export type AuthShellCopy = {
  title: string;
  subtitle?: string;
  contextLine?: string;
  securityNote?: string;
  forgotHint?: string;
};

/** Pre-auth top chrome: theme + language (one cluster, one flag). */
export const AUTH_SHELL_VARIANTS: Record<
  AuthShellVariant,
  { showTrustBadges: boolean; showAppearanceChrome: boolean }
> = {
  login: { showTrustBadges: true, showAppearanceChrome: true },
  'change-password': { showTrustBadges: false, showAppearanceChrome: false },
  info: { showTrustBadges: false, showAppearanceChrome: true },
};
