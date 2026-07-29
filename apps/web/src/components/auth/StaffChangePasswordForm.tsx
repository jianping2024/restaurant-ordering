'use client';

import { useRef, useState } from 'react';
import { signOutAndRedirect } from '@/lib/auth/sign-out-client';
import { StaffSignOutControl } from '@/components/staff/StaffSignOutControl';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@mesa/ui';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { StaffChangePasswordError } from '@/lib/auth/staff-change-password';

export type StaffChangePasswordIntent = 'forced' | 'voluntary';

type Props = {
  intent: StaffChangePasswordIntent;
  /** Voluntary success: close dialog / stay on page. Forced ignores and redirects. */
  onSuccess?: () => void;
};

function staffChangePasswordErrorMessage(
  code: StaffChangePasswordError | string,
  t: ReturnType<typeof getMessages>['staffAuth'],
): string {
  if (code === 'password_short') return t.passwordShort;
  if (code === 'password_mismatch') return t.passwordMismatch;
  if (code === 'password_same_as_old') return t.passwordSameAsOld;
  if (code === 'invalid_password') return t.invalid;
  if (code === 'unauthorized') return t.signInRequired;
  return t.changeFail;
}

/** Shared current/new/confirm password form — forced page or voluntary dialog. */
export function StaffChangePasswordForm({ intent, onSuccess }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).staffAuth;
  const auth = getMessages(lang).authLogin;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const submitLabel = intent === 'forced' ? t.changeSubmit : t.voluntaryChangeSubmit;

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
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        path?: string | null;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setError(staffChangePasswordErrorMessage(json.error ?? 'update_failed', t));
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      if (intent === 'forced') {
        if (!json.path) {
          setError(t.changeFail);
          setLoading(false);
          submittingRef.current = false;
          return;
        }
        window.location.assign(json.path);
        return;
      }

      onSuccess?.();
      setLoading(false);
      submittingRef.current = false;
    } catch {
      setError(t.changeFail);
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {intent === 'voluntary' ? (
        <p className="text-sm text-brand-text-muted">{t.voluntaryChangeSubtitle}</p>
      ) : null}
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
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        {submitLabel}
      </Button>
    </form>
  );

  if (intent === 'voluntary') {
    return form;
  }

  return (
    <AuthPageShell
      variant="change-password"
      toolbar={
        <div className="flex justify-end">
          <StaffSignOutControl
            exitLabel={t.signOut}
            onSignOut={() => void signOutAndRedirect('/auth/login')}
          />
        </div>
      }
      copy={{
        title: t.changeTitle,
        subtitle: t.changeSubtitle,
        securityNote: auth.staffSecurityNote,
      }}
    >
      {form}
    </AuthPageShell>
  );
}
