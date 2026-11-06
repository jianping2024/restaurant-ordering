'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PromptModal } from '@/components/ui/PromptModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { showToast } from '@/components/ui/Toast';
import { useLanguage } from '@/components/providers/LanguageProvider';
import {
  menuChoiceLocalizedName,
  type MenuChoiceGroup,
  type MenuChoiceOption,
} from '@/lib/menu-choice-options';

type PromptState =
  | null
  | { kind: 'group' }
  | { kind: 'option'; groupId: string };

type Props = {
  groups: MenuChoiceGroup[];
  options: MenuChoiceOption[];
  onChange: (next: { groups: MenuChoiceGroup[]; options: MenuChoiceOption[] }) => void;
};

/**
 * Dashboard 口味分组字典（最短路径：增删改名 + 启停；不做拖拽排序）。
 */
export function ChoiceGroupsManager({ groups, options, onChange }: Props) {
  const { lang } = useLanguage();
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [busy, setBusy] = useState(false);
  const [deleteGroup, setDeleteGroup] = useState<MenuChoiceGroup | null>(null);

  async function createGroup(name: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/menu/choice-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_zh: name,
          name_en: name,
          name_pt: name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || '创建分组失败', 'error');
        return;
      }
      onChange({ groups: [...groups, data.group], options });
    } finally {
      setBusy(false);
      setPrompt(null);
    }
  }

  async function createOption(groupId: string, name: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/menu/choice-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: groupId,
          name_zh: name,
          name_en: name,
          name_pt: name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || '创建口味失败', 'error');
        return;
      }
      onChange({ groups, options: [...options, data.option] });
    } finally {
      setBusy(false);
      setPrompt(null);
    }
  }

  async function removeGroup(group: MenuChoiceGroup) {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/menu/choice-groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: group.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(
          data.error === 'choice_group_has_options'
            ? '请先删掉组内口味'
            : data.error || '删除失败',
          'error',
        );
        return;
      }
      onChange({
        groups: groups.filter((g) => g.id !== group.id),
        options: options.filter((o) => o.group_id !== group.id),
      });
    } finally {
      setBusy(false);
      setDeleteGroup(null);
    }
  }

  async function toggleOptionActive(option: MenuChoiceOption) {
    const res = await fetch('/api/dashboard/menu/choice-options', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: option.id, active: !option.active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || '更新失败', 'error');
      return;
    }
    onChange({
      groups,
      options: options.map((o) => (o.id === option.id ? data.option : o)),
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-brand-text-muted">
          全店共用口味分组。建好后到「菜品」编辑里勾选；顾客点餐时每组单选必选一。
        </p>
        <Button type="button" size="sm" onClick={() => setPrompt({ kind: 'group' })} disabled={busy}>
          + 分组
        </Button>
      </div>

      <div className="space-y-3">
        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brand-border px-4 py-8 text-center text-sm text-brand-text-muted">
            还没有口味分组
          </p>
        ) : null}
        {groups.map((g) => {
          const opts = options.filter((o) => o.group_id === g.id);
          return (
            <div key={g.id} className="rounded-xl border border-brand-border bg-brand-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-brand-text">
                  {menuChoiceLocalizedName(g, lang)}
                  {!g.active ? (
                    <span className="ml-2 text-[12px] text-brand-text-muted">（已停用）</span>
                  ) : null}
                </p>
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    className="text-brand-gold"
                    disabled={busy}
                    onClick={() => setPrompt({ kind: 'option', groupId: g.id })}
                  >
                    + 口味
                  </button>
                  <button
                    type="button"
                    className="text-red-500/80"
                    disabled={busy}
                    onClick={() => setDeleteGroup(g)}
                  >
                    删除分组
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {opts.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => void toggleOptionActive(o)}
                    className={`rounded-full border px-2.5 py-1 text-[13px] ${
                      o.active
                        ? 'border-brand-border bg-brand-bg text-brand-text'
                        : 'border-brand-border bg-brand-bg/40 text-brand-text-muted line-through'
                    }`}
                    title="点击启停"
                  >
                    {menuChoiceLocalizedName(o, lang)}
                  </button>
                ))}
                {opts.length === 0 ? (
                  <span className="text-[12px] text-brand-text-muted">暂无口味</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <PromptModal
        open={prompt != null}
        onClose={() => setPrompt(null)}
        title={prompt?.kind === 'option' ? '新增口味' : '新增口味分组'}
        label={prompt?.kind === 'option' ? '口味名称' : '分组名称'}
        placeholder={prompt?.kind === 'option' ? '例如：清淡' : '例如：锅底'}
        submitLabel="添加"
        cancelLabel="取消"
        submitting={busy}
        onSubmit={async (value) => {
          if (prompt?.kind === 'option') await createOption(prompt.groupId, value);
          else await createGroup(value);
        }}
      />

      <ConfirmModal
        open={deleteGroup != null}
        onClose={() => setDeleteGroup(null)}
        title="删除口味分组"
        message={
          deleteGroup
            ? `确定删除「${menuChoiceLocalizedName(deleteGroup, lang)}」？组内不能有口味。`
            : ''
        }
        confirmLabel="删除"
        cancelLabel="取消"
        variant="danger"
        confirming={busy}
        onConfirm={() => {
          if (deleteGroup) void removeGroup(deleteGroup);
        }}
      />
    </div>
  );
}
