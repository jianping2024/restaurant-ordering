export type AuthShellVariant = 'login' | 'change-password' | 'info';

export type AuthShellHeroCopy = {
  eyebrow: string;
  headline: string;
  body: string;
};

/** Login help row — sole representation for install / forgot / contact-admin. */
export type AuthShellSupportCopy = {
  install: string;
  forgotPassword: string;
  contactAdmin: string;
  /** One tip for both forgot + contact actions. */
  adminHelpDetail: string;
};

export type AuthShellCopy = {
  title: string;
  subtitle?: string;
  contextLine?: string;
  securityNote?: string;
  hero?: AuthShellHeroCopy;
  support?: AuthShellSupportCopy;
};

/** Pre-auth chrome flags. `login` uses split shell; others stay centered card. */
export const AUTH_SHELL_VARIANTS: Record<
  AuthShellVariant,
  { layout: 'split' | 'card'; showAppearanceChrome: boolean }
> = {
  login: { layout: 'split', showAppearanceChrome: true },
  'change-password': { layout: 'card', showAppearanceChrome: false },
  info: { layout: 'card', showAppearanceChrome: true },
};
