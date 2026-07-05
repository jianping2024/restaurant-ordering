'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@mesa/ui';
import { useAuthLogin } from '@/lib/auth/use-auth-login';

type Props = {
  storeSlug?: string;
};

export function AuthLoginForm({ storeSlug }: Props) {
  const { account, setAccount, password, setPassword, loading, error, submit, t } = useAuthLogin({
    storeSlug,
  });

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={loading}>
      <Input
        label={t.account}
        type="text"
        autoComplete="username"
        placeholder={t.accountPlaceholder}
        value={account}
        onChange={(e) => setAccount(e.target.value)}
        required
        disabled={loading}
      />
      <PasswordInput
        label={t.password}
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={loading}
      />

      {error ? (
        <p className="mesa-alert-danger text-sm px-4 py-2" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        {t.login}
      </Button>
    </form>
  );
}
