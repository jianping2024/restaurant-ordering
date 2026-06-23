'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { parseStaffUserMetadata, staffPasswordValid } from '@/lib/staff-account';
import { staffRolePath } from '@/lib/staff-routes';
import { staffSignOut } from '@/lib/staff-auth-client';
import { StaffRoleToolbar } from '@/components/staff/StaffRoleToolbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

export default function StaffChangePasswordPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).staffAuth;
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
        router.replace('/auth/staff/login');
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
    router.replace('/auth/staff/login');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-text-muted text-sm">
        …
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-8 w-full max-w-sm">
        <StaffRoleToolbar exitLabel={t.signOut} onSignOut={() => void handleSignOut()} />
        <h1 className="font-heading text-3xl text-brand-gold text-center mb-2">{t.changeTitle}</h1>
        <p className="text-brand-text-muted text-sm text-center mb-6">{t.changeSubtitle}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t.password}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={loading}
          />
          <Input
            label={t.newPassword}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={loading}
          />
          <Input
            label={t.confirmPassword}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
          {error ? <p className="mesa-text-danger text-sm text-center">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {t.changeSubmit}
          </Button>
        </form>
      </div>
    </div>
  );
}
