'use client';

import { ProductLogo } from '@/components/ui/ProductLogo';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { AuthIconTextRow } from '@/components/auth/AuthIconTextRow';
import { AuthTrustBadges } from '@/components/auth/AuthTrustBadges';
import { AuthShieldIcon } from '@/components/auth/auth-icons';
import { AUTH_SHELL_VARIANTS, type AuthShellCopy, type AuthShellVariant } from '@/components/auth/auth-shell-variants';

type Props = {
  variant: AuthShellVariant;
  copy: AuthShellCopy;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function ShellSecurityNote({ text }: { text: string }) {
  return (
    <div className="mt-5 flex justify-center">
      <AuthIconTextRow
        icon={AuthShieldIcon}
        iconClassName="w-4 h-4 shrink-0 text-brand-gold mt-0.5"
        className="flex items-start gap-2 max-w-full"
      >
        <p className="text-brand-text-muted text-xs leading-relaxed">{text}</p>
      </AuthIconTextRow>
    </div>
  );
}

export function AuthPageShell({ variant, copy, toolbar, footer, children }: Props) {
  const { showTrustBadges, showLanguageSwitcher } = AUTH_SHELL_VARIANTS[variant];

  return (
    <div className="min-h-screen mesa-auth-bg flex flex-col items-center justify-center p-4">
      <div className="relative z-[1] w-full max-w-lg">
        {showLanguageSwitcher ? (
          <div className="flex justify-end mb-4">
            <LanguageSwitcher compact />
          </div>
        ) : null}

        <div className="rounded-2xl border border-brand-gold/25 bg-brand-card shadow-lg shadow-black/5 p-8">
          {toolbar ? <div className="mb-4">{toolbar}</div> : null}

          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <ProductLogo size="md" />
            </div>
            <h1 className="font-heading text-3xl text-brand-gold mb-2">{copy.title}</h1>
            {copy.subtitle ? (
              <p className="text-brand-text-muted text-sm">{copy.subtitle}</p>
            ) : null}
            {copy.contextLine ? (
              <p className="text-brand-text text-sm font-medium mt-2">{copy.contextLine}</p>
            ) : null}
          </div>

          {children}

          {copy.forgotHint ? (
            <p className="text-center text-brand-text-muted text-xs mt-4">{copy.forgotHint}</p>
          ) : null}

          {copy.securityNote ? <ShellSecurityNote text={copy.securityNote} /> : null}

          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>

        {showTrustBadges ? (
          <div className="flex justify-center">
            <AuthTrustBadges />
          </div>
        ) : null}
      </div>
    </div>
  );
}
