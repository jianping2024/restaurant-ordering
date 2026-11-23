'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  linkPlanReady,
  matchRoleByName,
  planStaffMembershipLinks,
  type LinkOverride,
  type LinkableRole,
} from '@mesa/shared';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Store = {
  id: string;
  name: string;
  slug: string;
  city: string;
  suspended: boolean;
  roles: LinkableRole[];
};

type Account = { userId: string; loginName: string; isPrintAgent: boolean };

type Membership = {
  membershipId: string;
  restaurantId: string;
  roleName: string;
  displayName: string;
  disabledAt: string | null;
};

type SubmitResult = { restaurantId: string; ok: boolean; error?: string; accountRetired?: boolean };

const ERROR_LABELS: Record<string, string> = {
  account_not_found: '找不到这个登录名的员工账号',
  print_agent_account: '打印设备账号只能属于一家店，不能关联或解除',
  owner_account: '这是店铺管理员账号，不能关联为员工',
  already_linked: '已经关联过这家店',
  invalid_role: '角色不存在或已停用',
  store_not_linkable: '这家店不是云端店，不能在这里关联',
  not_linked: '账号没有关联这家店',
  delete_failed: '解除失败',
  insert_failed: '写入失败',
  forbidden: '只有 admin 运营账号能关联或解除',
};

function errorLabel(code: string | undefined): string {
  return (code && ERROR_LABELS[code]) || code || '操作失败';
}

const NO_CITY = '未知城市';

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function StaffLinksClient({ canManage }: { canManage: boolean }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loginInput, setLoginInput] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [lookupError, setLookupError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [roleName, setRoleName] = useState('');
  const [overrides, setOverrides] = useState<Record<string, LinkOverride>>({});
  const [unlinkSelected, setUnlinkSelected] = useState<string[]>([]);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState('');
  const [failures, setFailures] = useState<SubmitResult[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/ops/staff-links/stores', { credentials: 'include' });
      const json = (await res.json().catch(() => ({}))) as { items?: Store[] };
      setStores(json.items ?? []);
      setLoadingStores(false);
    })();
  }, []);

  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const linkedIds = useMemo(() => new Set(memberships.map((m) => m.restaurantId)), [memberships]);

  const lookup = useCallback(async (login: string) => {
    setLookupError('');
    const res = await fetch(`/api/ops/staff-links?login=${encodeURIComponent(login)}`, {
      credentials: 'include',
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      account?: Account;
      memberships?: Membership[];
    };
    if (!res.ok || !json.account) {
      setAccount(null);
      setMemberships([]);
      setLookupError(errorLabel(json.error));
      return;
    }
    setAccount(json.account);
    setMemberships(json.memberships ?? []);
  }, []);

  const startLookup = async () => {
    setNotice('');
    setFailures([]);
    setSelected([]);
    setOverrides({});
    setUnlinkSelected([]);
    await lookup(loginInput.trim());
  };

  /** Role names across the selected stores, most common first. */
  const roleNameOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of selected) {
      for (const r of storeById.get(id)?.roles ?? []) counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
      .map(([name]) => name);
  }, [selected, storeById]);

  const effectiveRoleName = roleNameOptions.includes(roleName) ? roleName : roleNameOptions[0] ?? '';

  const plan = useMemo(
    () =>
      planStaffMembershipLinks({
        roleName: effectiveRoleName,
        stores: selected.map((id) => ({
          restaurantId: id,
          roles: storeById.get(id)?.roles ?? [],
          linked: linkedIds.has(id),
        })),
        overrides,
      }),
    [effectiveRoleName, selected, storeById, linkedIds, overrides],
  );
  const toLink = plan.filter((r) => r.status === 'matched' || r.status === 'chosen');
  const needsChoice = plan.filter(
    (r) => r.status === 'missing' || r.status === 'chosen' || r.status === 'skipped',
  );

  const filteredByCity = useMemo(() => {
    const q = fold(query.trim());
    const groups = new Map<string, Store[]>();
    for (const s of stores) {
      if (q && !fold(`${s.name} ${s.city} ${s.slug}`).includes(q)) continue;
      const city = s.city || NO_CITY;
      groups.set(city, [...(groups.get(city) ?? []), s]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a === NO_CITY ? 1 : b === NO_CITY ? -1 : a.localeCompare(b, 'pt'),
    );
  }, [stores, query]);

  const toggle = (ids: string[], on: boolean) => {
    const linkable = ids.filter((id) => !linkedIds.has(id));
    setSelected((prev) =>
      on ? Array.from(new Set([...prev, ...linkable])) : prev.filter((id) => !linkable.includes(id)),
    );
  };

  const submitLink = async () => {
    if (!account) return;
    setActing(true);
    setNotice('');
    setFailures([]);
    try {
      const res = await fetch('/api/ops/staff-links', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: account.userId,
          links: toLink.map((r) => ({
            restaurant_id: r.restaurantId,
            role_id: 'roleId' in r ? r.roleId : '',
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; results?: SubmitResult[] };
      if (!res.ok) {
        setNotice(errorLabel(json.error));
        return;
      }
      const results = json.results ?? [];
      const okCount = results.filter((r) => r.ok).length;
      const skipped = plan.filter((r) => r.status === 'skipped').length;
      setNotice(
        `已关联 ${okCount} 家店，每家店写了一条平台审计。${skipped ? `跳过 ${skipped} 家。` : ''}`,
      );
      setFailures(results.filter((r) => !r.ok));
      setSelected([]);
      setOverrides({});
      await lookup(account.loginName);
    } finally {
      setActing(false);
    }
  };

  const unlinkAll = unlinkSelected.length > 0 && unlinkSelected.length === memberships.length;

  const submitUnlink = async () => {
    if (!account) return;
    setActing(true);
    setNotice('');
    setFailures([]);
    try {
      const res = await fetch('/api/ops/staff-links', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: account.userId, restaurant_ids: unlinkSelected }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; results?: SubmitResult[] };
      if (!res.ok) {
        setNotice(errorLabel(json.error));
        return;
      }
      const results = json.results ?? [];
      const retired = results.some((r) => r.accountRetired);
      setNotice(
        `已解除 ${results.filter((r) => r.ok).length} 家店的关联。${retired ? '账号已没有任何店，已注销。' : ''}`,
      );
      setFailures(results.filter((r) => !r.ok));
      setUnlinkSelected([]);
      if (retired) {
        setAccount(null);
        setMemberships([]);
      } else {
        await lookup(account.loginName);
      }
    } finally {
      setActing(false);
      setConfirmUnlink(false);
    }
  };

  const storeName = (id: string) => storeById.get(id)?.name || id;
  const disabled = !canManage || acting || !account || account.isPrintAgent;

  return (
    <div>
      <h1 className="text-xl font-semibold">关联已有账号到多家店</h1>
      <p className="mt-1 text-sm text-zinc-400">
        只有 ops 能把员工账号关联到多家店。一次勾选多家店，统一指定角色名；系统按名字匹配每家店已有的角色。
        {canManage ? '' : '（只读：需要 admin 运营账号才能提交）'}
      </p>

      <form
        className="mt-5 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void startLookup();
        }}
      >
        <input
          value={loginInput}
          onChange={(e) => setLoginInput(e.target.value)}
          placeholder="员工登录名"
          autoComplete="off"
          className="h-10 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm"
        />
        <button
          type="submit"
          disabled={!loginInput.trim()}
          className="h-10 rounded-lg bg-amber-500 px-4 text-sm font-medium text-black disabled:opacity-50"
        >
          查找
        </button>
      </form>
      {lookupError ? <p className="mt-2 text-sm text-red-400">{lookupError}</p> : null}
      {notice ? <p className="mt-3 text-sm text-emerald-400">{notice}</p> : null}
      {failures.length ? (
        <ul className="mt-2 text-sm text-red-400">
          {failures.map((f) => (
            <li key={f.restaurantId}>
              {storeName(f.restaurantId)}：{errorLabel(f.error)}
            </li>
          ))}
        </ul>
      ) : null}

      {account ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(360px,1.3fr)]">
          <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-zinc-800 p-4">
              <h2 className="text-sm font-semibold">
                <span className="font-mono">{account.loginName}</span> 已关联 {memberships.length} 家店
              </h2>
              {account.isPrintAgent ? (
                <p className="mt-2 text-sm text-red-400">{errorLabel('print_agent_account')}</p>
              ) : null}
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {memberships.map((m) => (
                  <li key={m.membershipId}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={unlinkSelected.includes(m.restaurantId)}
                        onChange={(e) =>
                          setUnlinkSelected((prev) =>
                            e.target.checked
                              ? [...prev, m.restaurantId]
                              : prev.filter((id) => id !== m.restaurantId),
                          )
                        }
                      />
                      <span className="flex-1">{storeName(m.restaurantId)}</span>
                      <span className="text-zinc-400">{m.roleName}</span>
                      {m.disabledAt ? <span className="text-red-400">本店已停用</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={disabled || unlinkSelected.length === 0}
                onClick={() => setConfirmUnlink(true)}
                className="mt-3 h-9 rounded-lg border border-red-500/60 px-3 text-sm text-red-400 disabled:opacity-40"
              >
                解除关联 {unlinkSelected.length} 家店
              </button>
            </section>

            <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 p-4">
              <label className="text-sm font-semibold">
                在这些店的角色
                <select
                  value={effectiveRoleName}
                  disabled={roleNameOptions.length === 0}
                  onChange={(e) => {
                    setRoleName(e.target.value);
                    setOverrides({});
                  }}
                  className="mt-2 block h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm font-normal"
                >
                  {roleNameOptions.length === 0 ? <option value="">先在右侧勾选店铺</option> : null}
                  {roleNameOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-sm font-semibold">提交前预览</div>
              <p className="text-sm text-zinc-400">
                已选 <b className="text-zinc-100">{selected.length}</b> 家店，其中{' '}
                <b className="text-zinc-100">{plan.filter((r) => r.status === 'matched').length}</b>{' '}
                家能匹配到「{effectiveRoleName || '—'}」。
              </p>
              {needsChoice.length ? (
                <div className="rounded-lg border border-amber-500/40 p-3 text-sm">
                  <p className="text-amber-300">
                    以下 {needsChoice.length} 家没有「{effectiveRoleName}」角色，请逐家选角色或跳过：
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {needsChoice.map((row) => {
                      const store = storeById.get(row.restaurantId);
                      const value = overrides[row.restaurantId];
                      return (
                        <li key={row.restaurantId} className="flex items-center gap-2">
                          <span className="flex-1">{store?.name}</span>
                          <select
                            aria-label={`${store?.name ?? ''} 的角色`}
                            value={value === 'skip' ? 'skip' : value?.roleId ?? ''}
                            onChange={(e) =>
                              setOverrides((prev) => ({
                                ...prev,
                                [row.restaurantId]:
                                  e.target.value === 'skip' ? 'skip' : { roleId: e.target.value },
                              }))
                            }
                            className="h-8 rounded border border-zinc-700 bg-zinc-900 px-1"
                          >
                            <option value="" disabled>
                              请选择
                            </option>
                            {(store?.roles ?? []).map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                            <option value="skip">跳过这家</option>
                          </select>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <button
                type="button"
                disabled={disabled || !linkPlanReady(plan)}
                onClick={() => void submitLink()}
                className="h-10 rounded-lg bg-amber-500 px-4 text-sm font-medium text-black disabled:opacity-40"
              >
                关联 {toLink.length} 家店
              </button>
            </section>
          </div>

          <section className="rounded-xl border border-zinc-800 p-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索店名或城市"
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm"
            />
            {loadingStores ? <p className="mt-3 text-sm text-zinc-500">加载中…</p> : null}
            <div className="mt-2 max-h-[60vh] overflow-y-auto text-sm">
              {filteredByCity.map(([city, inCity]) => {
                const linkable = inCity.filter((s) => !linkedIds.has(s.id));
                const all = linkable.length > 0 && linkable.every((s) => selected.includes(s.id));
                return (
                  <div key={city} className="py-1">
                    <label className="flex items-center gap-2 py-1 font-semibold">
                      <input
                        type="checkbox"
                        disabled={linkable.length === 0}
                        checked={all}
                        onChange={(e) => toggle(inCity.map((s) => s.id), e.target.checked)}
                      />
                      {city}（全选 {linkable.length} 家）
                    </label>
                    {inCity.map((s) => {
                      const linked = linkedIds.has(s.id);
                      const missing =
                        !linked && !!effectiveRoleName && !matchRoleByName(s.roles, effectiveRoleName);
                      return (
                        <label key={s.id} className="flex items-center gap-2 py-1 pl-6">
                          <input
                            type="checkbox"
                            disabled={linked}
                            checked={linked || selected.includes(s.id)}
                            onChange={(e) => toggle([s.id], e.target.checked)}
                          />
                          <span className="flex-1">{s.name}</span>
                          {s.suspended ? <span className="text-xs text-zinc-500">已暂停</span> : null}
                          {linked ? <span className="text-xs text-emerald-400">已关联</span> : null}
                          {missing ? (
                            <span className="rounded bg-amber-500/15 px-1.5 text-xs text-amber-300">
                              无「{effectiveRoleName}」角色
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmUnlink}
        onClose={() => setConfirmUnlink(false)}
        title="解除关联"
        message={
          account
            ? `确认解除 ${account.loginName} 在 ${unlinkSelected.length} 家店的关联？${
                unlinkAll
                  ? '这是该账号剩下的全部店，解除后账号会被注销。'
                  : '只影响这些店，其他店不受影响。'
              }`
            : ''
        }
        confirmLabel="确认解除"
        cancelLabel="取消"
        variant="danger"
        confirming={acting}
        onConfirm={() => void submitUnlink()}
      />
    </div>
  );
}
