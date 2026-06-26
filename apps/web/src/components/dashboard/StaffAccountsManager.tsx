'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@mesa/ui';
import { Modal } from '@/components/ui/Modal';
import type { RestaurantStaffAccount, StaffAccountRole } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  normalizeLoginName,
  sanitizeStaffLoginInput,
  STAFF_EMAIL_DOMAIN,
  suggestLoginNameFromDisplay,
} from '@/lib/staff-account';

interface Props {
  initialStaff: RestaurantStaffAccount[];
  embedded?: boolean;
}

type FormState = {
  display_name: string;
  login_name: string;
  role: StaffAccountRole;
  password: string;
};

const emptyForm: FormState = {
  display_name: '',
  login_name: '',
  role: 'kitchen',
  password: '',
};

function errorMessage(code: string, t: ReturnType<typeof getMessages>['staffSettings']): string {
  const map: Record<string, string> = {
    login_name_invalid: t.errLoginInvalid,
    login_name_reserved: t.errLoginReserved,
    login_name_too_short: t.errLoginShort,
    login_name_taken: t.errLoginTaken,
    password_too_short: t.errPasswordShort,
    display_name_required: t.errDisplayName,
    migration_required: t.errMigration,
  };
  return map[code] || t.saveFail;
}

export function StaffAccountsManager({ initialStaff, embedded }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).staffSettings;

  const [staff, setStaff] = useState<RestaurantStaffAccount[]>(initialStaff);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editTarget, setEditTarget] = useState<RestaurantStaffAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<RestaurantStaffAccount | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RestaurantStaffAccount | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<RestaurantStaffAccount | null>(null);
  const [toggleSaving, setToggleSaving] = useState(false);

  const loginNameTouchedRef = useRef(false);
  const takenLogins = useMemo(
    () => new Set(staff.map((s) => normalizeLoginName(s.login_name))),
    [staff],
  );

  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 4000);
  }, []);

  const roleLabel = (role: StaffAccountRole) => {
    if (role === 'kitchen') return t.roleKitchen;
    if (role === 'cashier') return t.roleCashier;
    if (role === 'frontdesk') return t.roleFrontdesk;
    return t.roleWaiter;
  };

  const runCreate = async () => {
    setCreateSaving(true);
    setCreateError('');
    try {
      const res = await fetch('/api/dashboard/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const json = (await res.json().catch(() => ({}))) as { staff?: RestaurantStaffAccount; error?: string };
      if (!res.ok || !json.staff) {
        setCreateError(errorMessage(json.error || 'save_fail', t));
        return;
      }
      setStaff((prev) => [...prev, json.staff!].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      setCreateOpen(false);
      loginNameTouchedRef.current = false;
      setCreateForm(emptyForm);
      flash('ok', t.createdOk);
    } catch {
      setCreateError(t.saveFail);
    } finally {
      setCreateSaving(false);
    }
  };

  const runEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/dashboard/staff/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: editName }),
      });
      const json = (await res.json().catch(() => ({}))) as { staff?: RestaurantStaffAccount; error?: string };
      if (!res.ok || !json.staff) {
        flash('err', errorMessage(json.error || 'save_fail', t));
        return;
      }
      setStaff((prev) => prev.map((s) => (s.id === json.staff!.id ? json.staff! : s)));
      setEditTarget(null);
      flash('ok', t.updatedOk);
    } catch {
      flash('err', t.saveFail);
    } finally {
      setEditSaving(false);
    }
  };

  const runReset = async () => {
    if (!resetTarget) return;
    setResetSaving(true);
    try {
      const res = await fetch(`/api/dashboard/staff/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        flash('err', errorMessage(json.error || 'save_fail', t));
        return;
      }
      setResetTarget(null);
      setResetPassword('');
      flash('ok', t.resetOk);
    } catch {
      flash('err', t.saveFail);
    } finally {
      setResetSaving(false);
    }
  };

  const runToggle = async () => {
    if (!toggleTarget) return;
    setToggleSaving(true);
    const enabling = !!toggleTarget.disabled_at;
    try {
      const res = await fetch(`/api/dashboard/staff/${toggleTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: enabling ? 'enable' : 'disable' }),
      });
      const json = (await res.json().catch(() => ({}))) as { staff?: RestaurantStaffAccount; error?: string };
      if (!res.ok || !json.staff) {
        flash('err', errorMessage(json.error || 'save_fail', t));
        return;
      }
      setStaff((prev) => prev.map((s) => (s.id === json.staff!.id ? json.staff! : s)));
      setToggleTarget(null);
      flash('ok', enabling ? t.enabledOk : t.disabledOk);
    } catch {
      flash('err', t.saveFail);
    } finally {
      setToggleSaving(false);
    }
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      const res = await fetch(`/api/dashboard/staff/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        flash('err', t.saveFail);
        return;
      }
      setStaff((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      flash('ok', t.deletedOk);
    } catch {
      flash('err', t.saveFail);
    } finally {
      setDeleteSaving(false);
    }
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      flash('ok', t.copiedEmail);
    } catch {
      flash('err', t.copyFail);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {!embedded && (
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
        </div>
      )}


      {banner ? (
        <p
          className={`text-sm rounded-lg px-4 py-2 mb-4 border ${
            banner.kind === 'ok'
              ? 'text-green-400 bg-green-400/10 border-green-400/20'
              : 'mesa-badge-danger'
          }`}
        >
          {banner.text}
        </p>
      ) : null}

      <div className="mb-4 flex justify-end">
        <Button
          type="button"
          onClick={() => {
            loginNameTouchedRef.current = false;
            setCreateForm(emptyForm);
            setCreateError('');
            setCreateOpen(true);
          }}
        >
          + {t.add}
        </Button>
      </div>

      <div className="rounded-2xl border border-brand-border bg-brand-card overflow-hidden">
        {staff.length === 0 ? (
          <p className="p-8 text-center text-sm text-brand-text-muted">{t.empty}</p>
        ) : (
          <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-brand-text-muted text-left">
                  <th className="px-4 py-3 font-medium">{t.colName}</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">{t.colLogin}</th>
                  <th className="px-4 py-3 font-medium">{t.colRole}</th>
                  <th className="px-4 py-3 font-medium">{t.colStatus}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((row) => (
                  <tr key={row.id} className="border-b border-brand-border/60 last:border-0">
                    <td className="px-4 py-3 text-brand-text">{row.display_name}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <button
                        type="button"
                        onClick={() => void copyEmail(row.email)}
                        className="text-brand-gold hover:underline font-mono text-[12px]"
                        title={t.copyEmail}
                      >
                        {row.login_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-brand-text-muted">{roleLabel(row.role)}</td>
                    <td className="px-4 py-3">
                      {row.disabled_at ? (
                        <span className="mesa-text-danger">{t.statusDisabled}</span>
                      ) : (
                        <span className="text-green-400">{t.statusActive}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2 text-[12px]">
                        <button
                          type="button"
                          className="text-brand-text-muted hover:text-brand-text"
                          onClick={() => {
                            setEditTarget(row);
                            setEditName(row.display_name);
                          }}
                        >
                          {t.edit}
                        </button>
                        <button
                          type="button"
                          className="text-brand-text-muted hover:text-brand-text"
                          onClick={() => {
                            setResetTarget(row);
                            setResetPassword('');
                          }}
                        >
                          {t.resetPassword}
                        </button>
                        <button
                          type="button"
                          className="text-brand-text-muted hover:text-brand-text"
                          onClick={() => setToggleTarget(row)}
                        >
                          {row.disabled_at ? t.enable : t.disable}
                        </button>
                        <button
                          type="button"
                          className="text-status-danger hover:text-status-danger/80"
                          onClick={() => setDeleteTarget(row)}
                        >
                          {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>

      <Modal open={createOpen} onClose={() => !createSaving && setCreateOpen(false)} title={t.add}>
        <div className="space-y-4">
          <Input
            label={t.fieldDisplayName}
            value={createForm.display_name}
            onChange={(e) => {
              const v = e.target.value;
              setCreateForm((f) => ({
                ...f,
                display_name: v,
                login_name: loginNameTouchedRef.current
                  ? f.login_name
                  : suggestLoginNameFromDisplay(v, f.role, takenLogins),
              }));
            }}
            disabled={createSaving}
          />
          <div>
            <label className="text-sm text-brand-text-muted font-medium block mb-1.5">
              {t.fieldLoginPrefix}
            </label>
            <div
              className="flex w-full min-w-0 rounded-lg border border-brand-border bg-brand-card overflow-hidden focus-within:ring-2 focus-within:ring-brand-gold/50"
              aria-label={t.fieldLoginPrefix}
            >
              <input
                type="text"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[15px] text-brand-text placeholder:text-brand-muted focus:outline-none"
                placeholder={t.loginNamePlaceholder}
                value={createForm.login_name}
                disabled={createSaving}
                onChange={(e) => {
                  loginNameTouchedRef.current = true;
                  setCreateForm((f) => ({
                    ...f,
                    login_name: sanitizeStaffLoginInput(e.target.value),
                  }));
                }}
              />
              <div
                className="shrink-0 select-none flex items-center border-l border-brand-border bg-brand-bg/80 px-3 py-2.5 font-mono text-[13px] text-brand-text-muted"
                title={`@${STAFF_EMAIL_DOMAIN}`}
              >
                @{STAFF_EMAIL_DOMAIN}
              </div>
            </div>
            <p className="text-[12px] text-brand-text-muted mt-1.5">{t.loginNameAutoHint}</p>
            <button
              type="button"
              className="text-[12px] text-brand-gold hover:underline mt-1"
              disabled={createSaving || !createForm.display_name.trim()}
              onClick={() => {
                loginNameTouchedRef.current = false;
                setCreateForm((f) => ({
                  ...f,
                  login_name: suggestLoginNameFromDisplay(f.display_name, f.role, takenLogins),
                }));
              }}
            >
              {t.regenerateLoginName}
            </button>
          </div>
          <div>
            <label className="text-sm text-brand-text-muted block mb-1.5">{t.fieldRole}</label>
            <select
              className="w-full bg-brand-card border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text"
              value={createForm.role}
              onChange={(e) => {
                const role = e.target.value as StaffAccountRole;
                setCreateForm((f) => ({
                  ...f,
                  role,
                  login_name: loginNameTouchedRef.current
                    ? f.login_name
                    : suggestLoginNameFromDisplay(f.display_name, role, takenLogins),
                }));
              }}
              disabled={createSaving}
            >
              <option value="kitchen">{t.roleKitchen}</option>
              <option value="waiter">{t.roleWaiter}</option>
              <option value="cashier">{t.roleCashier}</option>
              <option value="frontdesk">{t.roleFrontdesk}</option>
            </select>
          </div>
          <PasswordInput
            label={t.fieldPassword}
            value={createForm.password}
            onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
            disabled={createSaving}
            placeholder={t.passwordPlaceholder}
          />
          {createError ? <p className="mesa-text-danger text-sm">{createError}</p> : null}
          <Button className="w-full" onClick={() => void runCreate()} disabled={createSaving}>
            {t.save}
          </Button>
        </div>
      </Modal>

      <Modal open={!!editTarget} onClose={() => !editSaving && setEditTarget(null)} title={t.edit}>
        <div className="space-y-4">
          <Input label={t.fieldDisplayName} value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Button className="w-full" onClick={() => void runEdit()} disabled={editSaving}>
            {t.save}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => !resetSaving && setResetTarget(null)}
        title={t.resetPassword}
      >
        <>
          <p className="text-sm text-brand-text-muted mb-3">{t.resetPasswordHint}</p>
          <PasswordInput
            label={t.fieldPassword}
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
          />
          <Button className="w-full mt-4" onClick={() => void runReset()} disabled={resetSaving}>
            {t.save}
          </Button>
        </>
      </Modal>

      <Modal
        open={!!toggleTarget}
        onClose={() => !toggleSaving && setToggleTarget(null)}
        title={toggleTarget?.disabled_at ? t.enable : t.disable}
      >
        <p className="text-sm text-brand-text-muted mb-4">
          {toggleTarget?.disabled_at ? t.enableConfirm : t.disableConfirm}
        </p>
        <Button className="w-full" onClick={() => void runToggle()} disabled={toggleSaving}>
          {t.confirm}
        </Button>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => !deleteSaving && setDeleteTarget(null)} title={t.delete}>
        <p className="text-sm text-brand-text-muted mb-4">{t.deleteConfirm}</p>
        <Button variant="outline" className="w-full" onClick={() => void runDelete()} disabled={deleteSaving}>
          {t.deleteConfirmBtn}
        </Button>
      </Modal>
    </div>
  );
}
