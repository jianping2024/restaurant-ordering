'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@mesa/ui';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import type { RestaurantStaffAccount } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import {
  LIST_DEFAULT_PAGE_SIZE,
  paginateList,
  type ListPageSize,
} from '@/lib/paginate-list';
import {
  normalizeLoginName,
  sanitizeStaffLoginInput,
  suggestLoginNameFromDisplay,
  isStaffRole,
  type StaffRole,
} from '@/lib/staff-account';
import {
  filterStaffByLoginName,
  sortStaffAccounts,
  type StaffSortDir,
  type StaffSortKey,
} from '@/lib/staff-accounts-list';
import type { RestaurantRoleRow } from '@/lib/permissions/types';

interface Props {
  initialStaff: RestaurantStaffAccount[];
  embedded?: boolean;
}

type RoleOption = Pick<RestaurantRoleRow, 'id' | 'name' | 'preset_key' | 'disabled_at'>;

type RolesLoadState = 'loading' | 'ready' | 'error';

type StaffSettingsCopy = ReturnType<typeof getMessages>['staffSettings'];

type FormState = {
  display_name: string;
  login_name: string;
  role_id: string;
  password: string;
};

const emptyForm: FormState = {
  display_name: '',
  login_name: '',
  role_id: '',
  password: '',
};

function loginTagForRole(role: RoleOption | undefined): StaffRole {
  const preset = role?.preset_key;
  if (preset && isStaffRole(preset)) return preset;
  return 'waiter';
}

function errorMessage(code: string, t: StaffSettingsCopy): string {
  const map: Record<string, string> = {
    login_name_invalid: t.errLoginInvalid,
    login_name_reserved: t.errLoginReserved,
    login_name_too_short: t.errLoginShort,
    login_name_taken: t.errLoginTaken,
    password_too_short: t.errPasswordShort,
    display_name_required: t.errDisplayName,
    migration_required: t.errMigration,
    invalid_role: t.saveFail,
  };
  return map[code] || t.saveFail;
}

function rolesSelectPlaceholder(loadState: RolesLoadState, t: StaffSettingsCopy): string {
  if (loadState === 'loading') return t.rolesLoading;
  if (loadState === 'error') return t.rolesLoadFail;
  return t.rolesEmpty;
}

/** One role picker for create + edit; empty/error copy is not saveFail. */
function StaffRoleSelect({
  value,
  onChange,
  disabled,
  activeRoles,
  loadState,
  t,
  onRetry,
}: {
  value: string;
  onChange: (roleId: string, role: RoleOption | undefined) => void;
  disabled: boolean;
  activeRoles: RoleOption[];
  loadState: RolesLoadState;
  t: StaffSettingsCopy;
  onRetry: () => void;
}) {
  const empty = activeRoles.length === 0;
  return (
    <div>
      <label className="text-sm text-brand-text-muted block mb-1.5">{t.fieldRole}</label>
      <select
        className="w-full bg-brand-card border border-brand-border rounded-lg px-4 py-2.5 text-base text-brand-text"
        value={value}
        onChange={(e) => {
          const roleId = e.target.value;
          onChange(
            roleId,
            activeRoles.find((r) => r.id === roleId),
          );
        }}
        disabled={disabled || empty}
      >
        {empty ? (
          <option value="">{rolesSelectPlaceholder(loadState, t)}</option>
        ) : (
          activeRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))
        )}
      </select>
      {loadState === 'error' ? (
        <button
          type="button"
          className="text-[12px] text-brand-gold hover:underline mt-1.5"
          disabled={disabled}
          onClick={onRetry}
        >
          {t.rolesRetry}
        </button>
      ) : null}
    </div>
  );
}

export function StaffAccountsManager({ initialStaff, embedded }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).staffSettings;

  const [staff, setStaff] = useState<RestaurantStaffAccount[]>(initialStaff);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolesLoadState, setRolesLoadState] = useState<RolesLoadState>('loading');
  const [loginSearch, setLoginSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ListPageSize>(LIST_DEFAULT_PAGE_SIZE);
  const [sortKey, setSortKey] = useState<StaffSortKey>('created_at');
  const [sortDir, setSortDir] = useState<StaffSortDir>('asc');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editTarget, setEditTarget] = useState<RestaurantStaffAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
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

  const activeRoles = useMemo(() => roles.filter((r) => !r.disabled_at), [roles]);

  const reloadRoles = useCallback(async () => {
    setRolesLoadState('loading');
    try {
      const res = await fetch('/api/dashboard/roles');
      const json = (await res.json().catch(() => ({}))) as { roles?: RoleOption[] };
      if (!res.ok || !Array.isArray(json.roles)) {
        setRoles([]);
        setRolesLoadState('error');
        return;
      }
      setRoles(json.roles);
      setRolesLoadState('ready');
    } catch {
      setRoles([]);
      setRolesLoadState('error');
    }
  }, []);

  useEffect(() => {
    void reloadRoles();
  }, [reloadRoles]);

  const filteredStaff = useMemo(
    () => filterStaffByLoginName(staff, loginSearch),
    [staff, loginSearch],
  );

  const sortedStaff = useMemo(
    () => sortStaffAccounts(filteredStaff, sortKey, sortDir),
    [filteredStaff, sortKey, sortDir],
  );

  const pagination = useMemo(
    () => paginateList(sortedStaff, page, pageSize),
    [sortedStaff, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [loginSearch, pageSize, staff.length, sortKey, sortDir]);

  const toggleSort = (key: StaffSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const sortMark = (key: StaffSortKey) => {
    if (sortKey === key) return sortDir === 'asc' ? '↑' : '↓';
    return '↕';
  };

  const createdLocale = lang === 'zh' ? 'zh-CN' : lang === 'pt' ? 'pt-PT' : 'en-GB';

  const roleLabel = (row: RestaurantStaffAccount) => row.role_name;

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
      showToast(t.createdOk, 'success');
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
        body: JSON.stringify({
          display_name: editName,
          ...(editRoleId && editRoleId !== editTarget.role_id ? { role_id: editRoleId } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { staff?: RestaurantStaffAccount; error?: string };
      if (!res.ok || !json.staff) {
        showToast(errorMessage(json.error || 'save_fail', t), 'error');
        return;
      }
      setStaff((prev) => prev.map((s) => (s.id === json.staff!.id ? json.staff! : s)));
      setEditTarget(null);
      showToast(t.updatedOk, 'success');
    } catch {
      showToast(t.saveFail, 'error');
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
        showToast(errorMessage(json.error || 'save_fail', t), 'error');
        return;
      }
      setResetTarget(null);
      setResetPassword('');
      showToast(t.resetOk, 'success');
    } catch {
      showToast(t.saveFail, 'error');
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
        showToast(errorMessage(json.error || 'save_fail', t), 'error');
        return;
      }
      setStaff((prev) => prev.map((s) => (s.id === json.staff!.id ? json.staff! : s)));
      setToggleTarget(null);
      showToast(enabling ? t.enabledOk : t.disabledOk, 'success');
    } catch {
      showToast(t.saveFail, 'error');
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
        showToast(t.saveFail, 'error');
        return;
      }
      setStaff((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast(t.deletedOk, 'success');
    } catch {
      showToast(t.saveFail, 'error');
    } finally {
      setDeleteSaving(false);
    }
  };

  const copyLoginName = async (loginName: string) => {
    try {
      await navigator.clipboard.writeText(loginName);
      showToast(t.copiedLoginName, 'success');
    } catch {
      showToast(t.copyFail, 'error');
    }
  };

  return (
    <div className="w-full max-w-full">
      {!embedded && (
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
        </div>
      )}

      <div className="w-fit max-w-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="w-full sm:w-52 shrink-0 p-1">
          <Input
            type="text"
            role="searchbox"
            value={loginSearch}
            onChange={(e) => setLoginSearch(e.target.value)}
            placeholder={t.searchLogin}
            aria-label={t.searchLogin}
            clearable
            clearLabel={t.clearSearch}
            className="bg-brand-bg focus:ring-brand-gold/40 focus:border-brand-gold/40"
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            loginNameTouchedRef.current = false;
            const defaultRoleId = activeRoles[0]?.id ?? '';
            setCreateForm({ ...emptyForm, role_id: defaultRoleId });
            setCreateError('');
            setCreateOpen(true);
          }}
        >
          + {t.add}
        </Button>
      </div>

      <div className="w-fit max-w-full rounded-2xl border border-brand-border bg-brand-card overflow-x-auto">
        {staff.length === 0 ? (
          <p className="p-8 text-center text-sm text-brand-text-muted">{t.empty}</p>
        ) : filteredStaff.length === 0 ? (
          <p className="p-8 text-center text-sm text-brand-text-muted">{t.emptyFiltered}</p>
        ) : (
          <table className="w-max table-fixed text-sm text-left">
            <thead>
              <tr className="border-b border-brand-border text-brand-text-muted">
                <th className="w-28 px-4 py-3 font-medium">{t.colName}</th>
                <th className="w-32 px-4 py-3 font-medium hidden sm:table-cell">
                  <button
                    type="button"
                    className="inline-flex max-w-full items-center gap-0.5 cursor-pointer hover:text-brand-text"
                    aria-label={t.sortByLogin}
                    onClick={() => toggleSort('login_name')}
                  >
                    <span className="truncate">{t.colLogin}</span>
                    <span
                      className={`inline-block w-3 shrink-0 text-center ${
                        sortKey === 'login_name' ? 'text-brand-text' : 'opacity-40'
                      }`}
                      aria-hidden
                    >
                      {sortMark('login_name')}
                    </span>
                  </button>
                </th>
                <th className="w-20 px-4 py-3 font-medium">{t.colRole}</th>
                <th className="w-16 px-4 py-3 font-medium">{t.colStatus}</th>
                <th className="w-36 px-4 py-3 font-medium hidden md:table-cell">
                  <button
                    type="button"
                    className="inline-flex max-w-full items-center gap-0.5 cursor-pointer hover:text-brand-text"
                    aria-label={t.sortByCreated}
                    onClick={() => toggleSort('created_at')}
                  >
                    <span className="truncate">{t.colCreated}</span>
                    <span
                      className={`inline-block w-3 shrink-0 text-center ${
                        sortKey === 'created_at' ? 'text-brand-text' : 'opacity-40'
                      }`}
                      aria-hidden
                    >
                      {sortMark('created_at')}
                    </span>
                  </button>
                </th>
                <th className="w-52 px-4 py-3 font-medium whitespace-nowrap">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {pagination.rows.map((row) => (
                <tr key={row.id} className="border-b border-brand-border/60 last:border-0">
                  <td className="max-w-0 px-4 py-3 text-brand-text">
                    <span className="block truncate" title={row.display_name}>
                      {row.display_name}
                    </span>
                  </td>
                  <td className="max-w-0 px-4 py-3 hidden sm:table-cell">
                    <button
                      type="button"
                      onClick={() => void copyLoginName(row.login_name)}
                      className="block max-w-full truncate text-left text-brand-gold hover:underline font-mono text-[12px]"
                      title={row.login_name}
                      aria-label={t.copyLoginName}
                    >
                      {row.login_name}
                    </button>
                  </td>
                  <td className="max-w-0 px-4 py-3 text-brand-text-muted">
                    <span className="block truncate" title={roleLabel(row)}>
                      {roleLabel(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.disabled_at ? (
                      <span className="mesa-text-danger">{t.statusDisabled}</span>
                    ) : (
                      <span className="text-green-400">{t.statusActive}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-brand-text-muted text-[12px] whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString(createdLocale, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-nowrap justify-start gap-2 text-[12px] whitespace-nowrap">
                      <button
                        type="button"
                        className="text-brand-text-muted hover:text-brand-text"
                        onClick={() => {
                          setEditTarget(row);
                          setEditName(row.display_name);
                          setEditRoleId(row.role_id);
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

        {staff.length > 0 && filteredStaff.length > 0 ? (
          <ListPaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pageSize}
            labels={{
              pageInfo: t.pageInfo,
              pageSizeLabel: t.pageSizeLabel,
              pagePrev: t.pagePrev,
              pageNext: t.pageNext,
            }}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </div>
      </div>

      <Modal open={createOpen} onClose={() => !createSaving && setCreateOpen(false)} title={t.add}>
        <div className="space-y-4">
          <Input
            label={t.fieldDisplayName}
            value={createForm.display_name}
            onChange={(e) => {
              const v = e.target.value;
              setCreateForm((f) => {
                const role = activeRoles.find((r) => r.id === f.role_id);
                return {
                  ...f,
                  display_name: v,
                  login_name: loginNameTouchedRef.current
                    ? f.login_name
                    : suggestLoginNameFromDisplay(v, loginTagForRole(role), takenLogins),
                };
              });
            }}
            disabled={createSaving}
          />
          <Input
            label={t.fieldLoginName}
            autoComplete="off"
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
          <p className="text-[12px] text-brand-text-muted -mt-2">{t.loginNameAutoHint}</p>
          <button
            type="button"
            className="text-[12px] text-brand-gold hover:underline mt-1"
            disabled={createSaving || !createForm.display_name.trim()}
            onClick={() => {
              loginNameTouchedRef.current = false;
              setCreateForm((f) => {
                const role = activeRoles.find((r) => r.id === f.role_id);
                return {
                  ...f,
                  login_name: suggestLoginNameFromDisplay(
                    f.display_name,
                    loginTagForRole(role),
                    takenLogins,
                  ),
                };
              });
            }}
          >
            {t.regenerateLoginName}
          </button>
          <StaffRoleSelect
            value={createForm.role_id}
            activeRoles={activeRoles}
            loadState={rolesLoadState}
            t={t}
            disabled={createSaving}
            onRetry={() => void reloadRoles()}
            onChange={(roleId, role) => {
              setCreateForm((f) => ({
                ...f,
                role_id: roleId,
                login_name: loginNameTouchedRef.current
                  ? f.login_name
                  : suggestLoginNameFromDisplay(
                      f.display_name,
                      loginTagForRole(role),
                      takenLogins,
                    ),
              }));
            }}
          />
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
          <StaffRoleSelect
            value={editRoleId}
            activeRoles={activeRoles}
            loadState={rolesLoadState}
            t={t}
            disabled={editSaving}
            onRetry={() => void reloadRoles()}
            onChange={(roleId) => setEditRoleId(roleId)}
          />
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
