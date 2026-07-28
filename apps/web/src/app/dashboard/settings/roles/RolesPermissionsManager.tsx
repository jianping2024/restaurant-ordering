'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
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

export function RolesPermissionsManager() {
  const { lang } = useLanguage();
  const t = rolePermissionsMessages(lang);

  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [editRole, setEditRole] = useState<RoleListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editPerms, setEditPerms] = useState<Set<PermissionKey>>(new Set());
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [copyFromId, setCopyFromId] = useState<string>('');

  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    setBanner({ kind, text });
    setTimeout(() => setBanner(null), 4000);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/roles');
      const json = (await res.json()) as { roles?: RoleListItem[]; error?: string };
      if (!res.ok) {
        flash('err', json.error || t.loadFail);
        return;
      }
      setRoles(json.roles ?? []);
    } finally {
      setLoading(false);
    }
  }, [flash, t.loadFail]);

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

  const openEdit = (role: RoleListItem) => {
    setEditRole(role);
    setEditName(role.name);
    setEditPerms(new Set(role.permissions));
  };

  const togglePerm = (key: PermissionKey) => {
    setEditPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveEdit = async () => {
    if (!editRole) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/roles/${editRole.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          permissions: Array.from(editPerms),
        }),
      });
      const json = (await res.json()) as { role?: RestaurantRoleRow; error?: string };
      if (!res.ok || !json.role) {
        flash('err', json.error || t.saveFail);
        return;
      }
      flash('ok', t.saveOk);
      setEditRole(null);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const setDisabled = async (role: RoleListItem, disabled: boolean) => {
    const res = await fetch(`/api/dashboard/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      flash('err', json.error || t.saveFail);
      return;
    }
    flash('ok', disabled ? t.disabledOk : t.enabledOk);
    await reload();
  };

  const removeRole = async (role: RoleListItem) => {
    if (!window.confirm(t.deleteConfirm.replace('{name}', role.name))) return;
    const res = await fetch(`/api/dashboard/roles/${role.id}`, { method: 'DELETE' });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      flash('err', json.error === 'role_in_use' ? t.roleInUse : json.error || t.saveFail);
      return;
    }
    flash('ok', t.deletedOk);
    await reload();
  };

  const createRole = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          copy_from_role_id: copyFromId || null,
          permissions: copyFromId ? undefined : [],
        }),
      });
      const json = (await res.json()) as { role?: RestaurantRoleRow; error?: string };
      if (!res.ok || !json.role) {
        flash('err', json.error === 'name_taken' ? t.nameTaken : json.error || t.saveFail);
        return;
      }
      setCreateOpen(false);
      setCreateName('');
      setCopyFromId('');
      flash('ok', t.createdOk);
      await reload();
      openEdit(json.role);
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = async () => {
    if (!editRole?.preset_key) return;
    if (!window.confirm(t.resetConfirm)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/roles/${editRole.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_to_template: true }),
      });
      const json = (await res.json()) as { role?: RestaurantRoleRow; error?: string };
      if (!res.ok || !json.role) {
        flash('err', json.error || t.saveFail);
        return;
      }
      setEditPerms(new Set(json.role.permissions));
      flash('ok', t.resetOk);
      await reload();
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-4">
      {banner ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            banner.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {banner.text}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">{t.intro}</p>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          {t.createRole}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">{t.loading}</p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {roles.map((role) => (
            <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-medium text-stone-900">
                  {role.name}
                  {role.preset_key ? (
                    <span className="ml-2 text-xs font-normal text-stone-500">{t.presetBadge}</span>
                  ) : (
                    <span className="ml-2 text-xs font-normal text-stone-500">{t.customBadge}</span>
                  )}
                  {role.disabled_at ? (
                    <span className="ml-2 text-xs font-normal text-amber-700">{t.disabledBadge}</span>
                  ) : null}
                </div>
                <div className="text-xs text-stone-500">
                  {t.permCount.replace('{n}', String(role.permissions.length))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => openEdit(role)}>
                  {t.edit}
                </Button>
                {role.disabled_at ? (
                  <Button type="button" variant="outline" onClick={() => void setDisabled(role, false)}>
                    {t.enable}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => void setDisabled(role, true)}>
                    {t.disable}
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => void removeRole(role)}>
                  {t.delete}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t.createRole}>
        <div className="space-y-3">
          <Input
            label={t.roleName}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <label className="block text-sm text-stone-700">
            {t.copyFrom}
            <select
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              value={copyFromId}
              onChange={(e) => setCopyFromId(e.target.value)}
            >
              <option value="">{t.copyNone}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="button" disabled={!createName.trim() || saving} onClick={() => void createRole()}>
              {t.create}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editRole)}
        onClose={() => setEditRole(null)}
        title={editRole ? t.editTitle.replace('{name}', editRole.name) : ''}
      >
        {editRole ? (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            <Input label={t.roleName} value={editName} onChange={(e) => setEditName(e.target.value)} />
            {editRole.preset_key ? (
              <Button type="button" variant="outline" onClick={() => void resetTemplate()}>
                {t.resetTemplate}
              </Button>
            ) : null}
            {Array.from(groupedKeys.entries()).map(([group, keys]) => (
              <div key={group}>
                <h3 className="mb-2 text-sm font-semibold text-stone-800">{groupLabel(group)}</h3>
                <ul className="space-y-1">
                  {keys.map((key: PermissionKey) => (
                    <li key={key}>
                      <label className="flex items-start gap-2 text-sm text-stone-700">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={editPerms.has(key)}
                          onChange={() => togglePerm(key)}
                        />
                        <span>
                          {permLabel(key)}
                          {Boolean((PERMISSIONS[key] as { dangerous?: boolean }).dangerous) ? (
                            <span className="ml-1 text-xs text-amber-700">({t.dangerous})</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <Button type="button" variant="outline" onClick={() => setEditRole(null)}>
                {t.cancel}
              </Button>
              <Button type="button" disabled={saving} onClick={() => void saveEdit()}>
                {t.save}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
