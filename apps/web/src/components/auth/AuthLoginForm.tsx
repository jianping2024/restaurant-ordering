'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@mesa/ui';
import { useAuthLogin } from '@/lib/auth/use-auth-login';

type Props = {
  storeSlug?: string;
};

const LOGIN_FIELD_CLASS =
  'h-[50px] rounded-xl border-brand-border/90 bg-brand-card/70 px-4 py-0 text-[15px] focus:ring-brand-ink/25 md:h-[50px]';

export function AuthLoginForm({ storeSlug }: Props) {
  const { account, setAccount, password, setPassword, loading, error, submit, t } = useAuthLogin({
    storeSlug,
  });

  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get('email');
    if (email) setAccount(email);
  }, [setAccount]);

  return (
    <form onSubmit={submit} className="space-y-3 md:space-y-3.5" aria-busy={loading}>
      <Input
        label={t.account}
        type="text"
        autoComplete="username"
        inputMode="email"
        placeholder={t.accountPlaceholder}
        value={account}
        onChange={(e) => setAccount(e.target.value)}
        clearable
        clearLabel={t.clearAccount}
        required
        disabled={loading}
        className={LOGIN_FIELD_CLASS}
      />
      <PasswordInput
        label={t.password}
        autoComplete="current-password"
        placeholder={t.passwordPlaceholder}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={loading}
        labelClassName="text-sm font-semibold text-brand-text"
        inputClassName={`w-full border rounded-xl text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-ink/25 transition-colors duration-200 border-brand-border/90 bg-brand-card/70 ${LOGIN_FIELD_CLASS} pr-12`}
        toggleClassName="absolute right-1 top-0 flex h-full w-12 items-center justify-center text-brand-text-muted hover:text-brand-text disabled:opacity-50 disabled:pointer-events-none"
      />

      {error ? (
        <p className="mesa-alert-danger text-sm px-4 py-2" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="mt-1 h-[52px] w-full rounded-xl text-[17px] tracking-wide shadow-md shadow-brand-ink/20"
        size="lg"
        loading={loading}
      >
        {t.login}
      </Button>
    </form>
  );
}
