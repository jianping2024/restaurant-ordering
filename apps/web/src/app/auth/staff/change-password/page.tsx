'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { parseStaffUserMetadata, staffPasswordValid } from '@/lib/staff-account';
import { staffRolePath } from '@/lib/staff-routes';
import { staffSignOut } from '@/lib/staff-auth-client';
import { StaffSignOutControl } from '@/components/staff/StaffSignOutControl';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@mesa/ui';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

export default function StaffChangePasswordPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).staffAuth;
  const auth = getMessages(lang).authLogin;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = parseStaffUserMetadata(user?.user_metadata as Record<string, unknown>);
      if (!user || !meta) {
        router.replace('/auth/login');
        return;
      }
      setChecking(false);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError('');

    if (!staffPasswordValid(newPassword)) {
      setError(t.passwordShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    if (newPassword === currentPassword) {
      setError(t.passwordSameAsOld);
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const meta = parseStaffUserMetadata(user?.user_metadata as Record<string, unknown>);
      if (!user?.email || !meta) {
        setError(t.signInRequired);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setError(t.invalid);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { ...user.user_metadata, must_change_password: false },
      });

      if (updateError) {
        setError(t.changeFail);
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      router.push(staffRolePath(meta.restaurant_slug, meta.staff_role));
      router.refresh();
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

  if (checking) {
    return (
      <div className="min-h-screen mesa-auth-bg flex items-center justify-center text-brand-text-muted text-sm">
        …
      </div>
    );
  }

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
        {error ? <p className="mesa-text-danger text-sm text-center">{error}</p> : null}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {t.changeSubmit}
        </Button>
      </form>
    </AuthPageShell>
  );
}
