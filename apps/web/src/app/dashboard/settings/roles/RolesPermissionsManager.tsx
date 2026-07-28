'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { showToast } from '@/components/ui/Toast';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { rolePermissionsMessages } from '@/lib/i18n/role-permissions-messages';
import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  PERMISSION_GROUPS,
  type PermissionKey,
} from '@/lib/permissions/registry';
import type { RestaurantRoleRow } from '@/lib/permissions/types';

type RoleListItem = RestaurantRoleRow & { staff_count?: number };

/** Sole screen mode for this settings surface — list or one in-page form. */
type View = 'list' | 'form';

type FormDraft = {
  intent: 'create' | 'edit';
  roleId: string | null;
  presetKey: string | null;
  name: string;
  /** Create-only: seeds `permissions` when changed; never sent on POST. */
  copyFromId: string;
  permissions: Set<PermissionKey>;
};

type PendingConfirm =
  | { kind: 'leave' }
  | { kind: 'delete'; role: RoleListItem }
  | { kind: 'disable'; role: RoleListItem }
  | { kind: 'reset' }
  | null;

function draftFingerprint(d: FormDraft): string {
  return JSON.stringify({
    intent: d.intent,
    roleId: d.roleId,
    name: d.name.trim(),
    copyFromId: d.copyFromId,
    permissions: Array.from(d.permissions).sort(),
  });
}

export function RolesPermissionsManager() {
  const { lang } = useLanguage();
  const t = rolePermissionsMessages(lang);

  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [baselineFp, setBaselineFp] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingConfirm>(null);
  const [confirming, setConfirming] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/roles');
      const json = (await res.json()) as { roles?: RoleListItem[]; error?: string };
      if (!res.ok) {
        showToast(json.error || t.loadFail, 'error');
        return;
      }
      setRoles(json.roles ?? []);
    } finally {
      setLoading(false);
    }
  }, [t.loadFail]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groupedKeys = useMemo(() => {
    const map = new Map<string, PermissionKey[]>();
    for (const group of PERMISSION_GROUPS) {
      map.set(
        group,
        ALL_PERMISSION_KEYS.filter((key) => PERMISSIONS[key].group === group),
      );
    }
    return map;
  }, []);

  const isDirty = draft != null && draftFingerprint(draft) !== baselineFp;

  const openCreate = () => {
    const next: FormDraft = {
      intent: 'create',
      roleId: null,
      presetKey: null,
      name: '',
      copyFromId: '',
      permissions: new Set(),
    };
    setDraft(next);
    setBaselineFp(draftFingerprint(next));
    setView('form');
  };

  const openEdit = (role: RoleListItem) => {
    const next: FormDraft = {
      intent: 'edit',
      roleId: role.id,
      presetKey: role.preset_key,
      name: role.name,
      copyFromId: '',
      permissions: new Set(role.permissions),
    };
    setDraft(next);
    setBaselineFp(draftFingerprint(next));
    setView('form');
  };

  const requestLeaveForm = () => {
    if (!draft) {
      setView('list');
      return;
    }
    if (isDirty) {
      setPending({ kind: 'leave' });
      return;
    }
    setDraft(null);
    setView('list');
  };

  const leaveFormNow = () => {
    setDraft(null);
    setBaselineFp('');
    setView('list');
    setPending(null);
  };

  const applyCopyFrom = (copyFromId: string) => {
    setDraft((prev) => {
      if (!prev || prev.intent !== 'create') return prev;
      const source = roles.find((r) => r.id === copyFromId);
      return {
        ...prev,
        copyFromId,
        permissions: source ? new Set(source.permissions) : new Set(),
      };
    });
  };

  const togglePerm = (key: PermissionKey) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.permissions);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, permissions: next };
    });
  };

  const saveForm = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      showToast(t.nameRequired, 'error');
      return;
    }
    setSaving(true);
    try {
      if (draft.intent === 'create') {
        const res = await fetch('/api/dashboard/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            permissions: Array.from(draft.permissions),
          }),
        });
        const json = (await res.json()) as { role?: RestaurantRoleRow; error?: string };
        if (!res.ok || !json.role) {
          showToast(json.error === 'name_taken' ? t.nameTaken : json.error || t.saveFail, 'error');
          return;
        }
        showToast(t.createdOk, 'success');
        leaveFormNow();
        await reload();
        return;
      }

      if (!draft.roleId) return;
      const res = await fetch(`/api/dashboard/roles/${draft.roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          permissions: Array.from(draft.permissions),
        }),
      });
      const json = (await res.json()) as { role?: RestaurantRoleRow; error?: string };
      if (!res.ok || !json.role) {
        showToast(json.error === 'name_taken' ? t.nameTaken : json.error || t.saveFail, 'error');
        return;
      }
      showToast(t.saveOk, 'success');
      leaveFormNow();
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const runDisable = async (role: RoleListItem) => {
    const res = await fetch(`/api/dashboard/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: true }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      showToast(json.error || t.saveFail, 'error');
      return;
    }
    showToast(t.disabledOk, 'success');
    await reload();
  };

  const runEnable = async (role: RoleListItem) => {
    const res = await fetch(`/api/dashboard/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: false }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      showToast(json.error || t.saveFail, 'error');
      return;
    }
    showToast(t.enabledOk, 'success');
    await reload();
  };

  const runDelete = async (role: RoleListItem) => {
    const res = await fetch(`/api/dashboard/roles/${role.id}`, { method: 'DELETE' });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      showToast(json.error === 'role_in_use' ? t.roleInUse : json.error || t.saveFail, 'error');
      return;
    }
    showToast(t.deletedOk, 'success');
    await reload();
  };

  const runResetTemplate = async () => {
    if (!draft?.roleId || !draft.presetKey) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/roles/${draft.roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_to_template: true }),
      });
      const json = (await res.json()) as { role?: RestaurantRoleRow; error?: string };
      if (!res.ok || !json.role) {
        showToast(json.error || t.saveFail, 'error');
        return;
      }
      const next: FormDraft = {
        ...draft,
        name: json.role.name,
        permissions: new Set(json.role.permissions),
      };
      setDraft(next);
      setBaselineFp(draftFingerprint(next));
      showToast(t.resetOk, 'success');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const onConfirmPending = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      if (pending.kind === 'leave') {
        leaveFormNow();
        return;
      }
      if (pending.kind === 'delete') {
        await runDelete(pending.role);
        setPending(null);
        return;
      }
      if (pending.kind === 'disable') {
        await runDisable(pending.role);
        setPending(null);
        return;
      }
      if (pending.kind === 'reset') {
        await runResetTemplate();
        setPending(null);
      }
    } finally {
      setConfirming(false);
    }
  };

  const permLabel = (key: PermissionKey) => {
    const labelKey = PERMISSIONS[key].labelKey as keyof typeof t.perm;
    return t.perm[labelKey] || key;
  };

  const groupLabel = (group: string) => {
    const k = group as keyof typeof t.groups;
    return t.groups[k] || group;
  };

  const confirmCopy = (() => {
    if (!pending) return { title: '', message: '', confirmLabel: t.confirm, variant: 'default' as const };
    if (pending.kind === 'leave') {
      return {
        title: t.discardTitle,
        message: t.discardConfirm,
        confirmLabel: t.discard,
        variant: 'default' as const,
      };
    }
    if (pending.kind === 'delete') {
      return {
        title: t.delete,
        message: t.deleteConfirm.replace('{name}', pending.role.name),
        confirmLabel: t.delete,
        variant: 'danger' as const,
      };
    }
    if (pending.kind === 'disable') {
      return {
        title: t.disable,
        message: t.disableConfirm.replace('{name}', pending.role.name),
        confirmLabel: t.disable,
        variant: 'default' as const,
      };
    }
    return {
      title: t.resetTemplate,
      message: t.resetConfirm,
      confirmLabel: t.resetTemplate,
      variant: 'default' as const,
    };
  })();

  return (
    <div className="space-y-4">
      {view === 'list' ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-brand-text-muted max-w-2xl">{t.intro}</p>
            <Button type="button" onClick={openCreate} className="shrink-0">
              {t.createRole}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-brand-text-muted">{t.loading}</p>
          ) : (
            <ul className="rounded-2xl border border-brand-border bg-brand-card divide-y divide-brand-border overflow-hidden">
              {roles.map((role) => (
                <li
                  key={role.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-brand-text">
                      {role.name}
                      {role.preset_key ? (
                        <span className="ml-2 text-xs font-normal text-brand-text-muted">
                          {t.presetBadge}
                        </span>
                      ) : (
                        <span className="ml-2 text-xs font-normal text-brand-text-muted">
                          {t.customBadge}
                        </span>
                      )}
                      {role.disabled_at ? (
                        <span className="ml-2 text-xs font-normal text-amber-800">{t.disabledBadge}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-brand-text-muted mt-0.5">
                      {t.permCount.replace('{n}', String(role.permissions.length))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(role)}>
                      {t.edit}
                    </Button>
                    {role.disabled_at ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void runEnable(role)}
                      >
                        {t.enable}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPending({ kind: 'disable', role })}
                      >
                        {t.disable}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPending({ kind: 'delete', role })}
                    >
                      {t.delete}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : draft ? (
        <div className="space-y-5 pb-24">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={requestLeaveForm}>
              {t.backToList}
            </Button>
            <h2 className="font-heading text-xl text-brand-text">
              {draft.intent === 'create'
                ? t.createRole
                : t.editTitle.replace('{name}', draft.name || '…')}
            </h2>
          </div>

          <div className="space-y-4 max-w-2xl">
            <Input
              label={t.roleName}
              value={draft.name}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
            />

            {draft.intent === 'create' ? (
              <label className="block text-sm text-brand-text">
                <span className="font-medium">{t.copyFrom}</span>
                <select
                  className="mt-1 w-full rounded-lg border border-brand-border bg-brand-card px-3 py-2.5 text-sm text-brand-text"
                  value={draft.copyFromId}
                  onChange={(e) => applyCopyFrom(e.target.value)}
                >
                  <option value="">{t.copyNone}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {draft.intent === 'edit' && draft.presetKey ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setPending({ kind: 'reset' })}
              >
                {t.resetTemplate}
              </Button>
            ) : null}
          </div>

          <div className="space-y-6">
            {Array.from(groupedKeys.entries()).map(([group, keys]) => (
              <section key={group}>
                <h3 className="text-sm font-medium text-brand-text mb-2">{groupLabel(group)}</h3>
                <div className="bg-brand-card border border-brand-border rounded-xl divide-y divide-brand-border">
                  {keys.map((key) => (
                    <label
                      key={key}
                      className="flex items-start gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-brand-border/20 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
                        checked={draft.permissions.has(key)}
                        onChange={() => togglePerm(key)}
                      />
                      <span className="min-w-0 text-[15px] text-brand-text">
                        {permLabel(key)}
                        {Boolean((PERMISSIONS[key] as { dangerous?: boolean }).dangerous) ? (
                          <span className="ml-1 text-xs text-amber-800">({t.dangerous})</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="fixed bottom-0 inset-x-0 z-20 border-t border-brand-border bg-brand-bg/95 backdrop-blur-sm px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto max-w-4xl flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={requestLeaveForm}>
                {t.cancel}
              </Button>
              <Button
                type="button"
                loading={saving}
                disabled={!draft.name.trim()}
                onClick={() => void saveForm()}
              >
                {draft.intent === 'create' ? t.create : t.save}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={pending != null}
        onClose={() => !confirming && setPending(null)}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.confirmLabel}
        cancelLabel={t.cancel}
        variant={confirmCopy.variant}
        confirming={confirming}
        onConfirm={() => void onConfirmPending()}
      />
    </div>
  );
}
