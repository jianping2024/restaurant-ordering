export type AuthShellVariant = 'login' | 'change-password' | 'info';

export type AuthShellCopy = {
  title: string;
  subtitle?: string;
  contextLine?: string;
  securityNote?: string;
  forgotHint?: string;
  complianceNote?: string;
};

export const AUTH_SHELL_VARIANTS: Record<AuthShellVariant, { showTrustBadges: boolean }> = {
  login: { showTrustBadges: true },
  'change-password': { showTrustBadges: false },
  info: { showTrustBadges: false },
};
