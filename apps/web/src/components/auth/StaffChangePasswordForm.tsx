'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffSignOut } from '@/lib/staff-auth-client';
import { StaffSignOutControl } from '@/components/staff/StaffSignOutControl';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@mesa/ui';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { StaffChangePasswordError } from '@/lib/auth/staff-change-password';

export function StaffChangePasswordForm() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).staffAuth;
  const auth = getMessages(lang).authLogin;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const errorMessage = (code: StaffChangePasswordError | string) => {
    if (code === 'password_short') return t.passwordShort;
    if (code === 'password_mismatch') return t.passwordMismatch;
    if (code === 'password_same_as_old') return t.passwordSameAsOld;
    if (code === 'invalid_password') return t.invalid;
    if (code === 'unauthorized') return t.signInRequired;
    return t.changeFail;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError('');
    submittingRef.current = true;
    setLoading(true);

    try {
      const res = await fetch('/api/auth/staff/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; path?: string; error?: string };

      if (!res.ok || !json.ok || !json.path) {
        setError(errorMessage(json.error ?? 'update_failed'));
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      window.location.assign(json.path);
    } catch {
      setError(t.changeFail);
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleSignOut = async () => {
    await staffSignOut();
    router.replace('/auth/login');
  };

  return (
    <AuthPageShell
      variant="change-password"
      toolbar={
        <div className="flex justify-end">
          <StaffSignOutControl exitLabel={t.signOut} onSignOut={() => void handleSignOut()} />
        </div>
      }
      copy={{
        title: t.changeTitle,
        subtitle: t.changeSubtitle,
        securityNote: auth.staffSecurityNote,
      }}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label={t.password}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          disabled={loading}
        />
        <PasswordInput
          label={t.newPassword}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          disabled={loading}
        />
        <PasswordInput
          label={t.confirmPassword}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
        />
        {error ? (
          <p className="mesa-text-danger text-sm text-center" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" size="lg" disabled={loading} loading={loading}>
          {t.changeSubmit}
        </Button>
      </form>
    </AuthPageShell>
  );
}
