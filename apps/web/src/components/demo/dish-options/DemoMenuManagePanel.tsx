'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import { PromptModal } from '@/components/ui/PromptModal';
import { mesaSelectionChipShellClass, mesaSelectionChipSoftClass } from '@/lib/mesa-selection-chip';
import { FORM_CONTROL_TEXT_CLASS } from '@/lib/form-control-text';
import {
  DEMO_CATEGORIES,
  type DemoDish,
  type DemoFlavorGroup,
  money,
} from '@/lib/demo-dish-options-catalog';

const DEMO_SELECT_CLASS =
  `mt-1.5 w-full appearance-none rounded-xl border border-brand-border bg-brand-card px-3 py-2.5 ${FORM_CONTROL_TEXT_CLASS} text-brand-text shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/35 focus:border-brand-gold/40`;

type ManageTab = 'items' | 'flavor_groups';
type PromptKind = null | { kind: 'group' } | { kind: 'option'; groupId: string };

type EditDraft = {
  dishId: string;
  flavorBindings: { groupId: string; optionIds: string[] }[];
  toppingEnabled: boolean;
  toppingRequired: boolean;
  /** 只挑一个类别 */
  toppingCategoryId: string;
  /**
   * 勾选的菜；与「全选本类」配合：
   * - 全选 / 未改过全类 → 用 empty + allSelected 表示该类全部
   * - 部分勾 → 具体 id
   */
  toppingItemIds: string[];
  toppingAllInCategory: boolean;
};

type Props = {
  dishes: DemoDish[];
  flavorGroups: DemoFlavorGroup[];
  onSaveDishBindings: (
    dishId: string,
    next: Pick<DemoDish, 'flavorBindings' | 'toppingBinding'>,
  ) => void;
  onAddFlavorGroup: (name: string) => void;
  onAddFlavorOption: (groupId: string, name: string) => void;
};

export function DemoMenuManagePanel({
  dishes,
  flavorGroups,
  onSaveDishBindings,
  onAddFlavorGroup,
  onAddFlavorOption,
}: Props) {
  const [manageTab, setManageTab] = useState<ManageTab>('items');
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [prompt, setPrompt] = useState<PromptKind>(null);

  const editableDishes = useMemo(
    () =>
      dishes.filter((d) =>
        ['cat-noodle', 'cat-hotpot', 'cat-soup', 'cat-topping'].includes(d.categoryId),
      ),
    [dishes],
  );

  const editingDish = editDraft
    ? dishes.find((d) => d.id === editDraft.dishId) ?? null
    : null;

  function openEdit(dish: DemoDish) {
    const binding = dish.toppingBinding;
    setEditDraft({
      dishId: dish.id,
      flavorBindings: dish.flavorBindings.map((b) => ({
        groupId: b.groupId,
        optionIds: [...b.optionIds],
      })),
      toppingEnabled: binding != null,
      toppingRequired: binding?.required ?? false,
      toppingCategoryId: binding?.categoryId ?? '',
      toppingItemIds: binding && binding.itemIds.length > 0 ? [...binding.itemIds] : [],
      toppingAllInCategory: Boolean(binding && binding.itemIds.length === 0),
    });
  }

  function closeEdit() {
    setEditDraft(null);
  }

  function saveEdit() {
    if (!editDraft) return;
    const toppingBinding =
      editDraft.toppingEnabled && editDraft.toppingCategoryId
        ? {
            categoryId: editDraft.toppingCategoryId,
            itemIds: editDraft.toppingAllInCategory ? [] : [...editDraft.toppingItemIds],
            required: editDraft.toppingRequired,
          }
        : null;
    if (
      toppingBinding &&
      !toppingBinding.itemIds.length &&
      !editDraft.toppingAllInCategory
    ) {
      // 启用了但既没全选也没勾菜 → 当未启用
      onSaveDishBindings(editDraft.dishId, {
        flavorBindings: editDraft.flavorBindings,
        toppingBinding: null,
      });
      closeEdit();
      return;
    }
    onSaveDishBindings(editDraft.dishId, {
      flavorBindings: editDraft.flavorBindings,
      toppingBinding,
    });
    closeEdit();
  }

  function toggleFlavorOption(groupId: string, optionId: string) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const bindings = [...prev.flavorBindings];
      const bi = bindings.findIndex((b) => b.groupId === groupId);
      if (bi < 0) {
        return {
          ...prev,
          flavorBindings: [...bindings, { groupId, optionIds: [optionId] }],
        };
      }
      const binding = bindings[bi]!;
      const has = binding.optionIds.includes(optionId);
      const optionIds = has
        ? binding.optionIds.filter((id) => id !== optionId)
        : [...binding.optionIds, optionId];
      if (optionIds.length === 0) bindings.splice(bi, 1);
      else bindings[bi] = { groupId, optionIds };
      return { ...prev, flavorBindings: bindings };
    });
  }

  function setToppingCategory(categoryId: string) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        toppingCategoryId: categoryId,
        toppingItemIds: [],
        toppingAllInCategory: false,
      };
    });
  }

  function categoryDishIds(categoryId: string, selfId: string): string[] {
    return dishes
      .filter((d) => d.categoryId === categoryId && d.id !== selfId && d.available)
      .map((d) => d.id);
  }

  function isItemOn(itemId: string): boolean {
    if (!editDraft) return false;
    if (editDraft.toppingAllInCategory) return true;
    return editDraft.toppingItemIds.includes(itemId);
  }

  function toggleToppingItem(itemId: string) {
    setEditDraft((prev) => {
      if (!prev || !prev.toppingCategoryId) return prev;
      const allIds = categoryDishIds(prev.toppingCategoryId, prev.dishId);
      if (prev.toppingAllInCategory) {
        // 从「全选」变成去掉这一道
        return {
          ...prev,
          toppingAllInCategory: false,
          toppingItemIds: allIds.filter((id) => id !== itemId),
        };
      }
      const has = prev.toppingItemIds.includes(itemId);
      const next = has
        ? prev.toppingItemIds.filter((id) => id !== itemId)
        : [...prev.toppingItemIds, itemId];
      if (next.length === allIds.length && allIds.length > 0) {
        return { ...prev, toppingAllInCategory: true, toppingItemIds: [] };
      }
      return { ...prev, toppingItemIds: next, toppingAllInCategory: false };
    });
  }

  function selectAllInCategory() {
    setEditDraft((prev) =>
      prev
        ? { ...prev, toppingAllInCategory: true, toppingItemIds: [] }
        : prev,
    );
  }

  function clearSelection() {
    setEditDraft((prev) =>
      prev
        ? { ...prev, toppingAllInCategory: false, toppingItemIds: [] }
        : prev,
    );
  }

  function bindingSummary(dish: DemoDish): string {
    const parts: string[] = [];
    if (dish.flavorBindings.length) parts.push(`口味组 ${dish.flavorBindings.length}`);
    if (dish.toppingBinding) {
      const cat = DEMO_CATEGORIES.find((c) => c.id === dish.toppingBinding!.categoryId);
      const scope =
        dish.toppingBinding.itemIds.length === 0
          ? `${cat?.name ?? '类'}·全部`
          : `${cat?.name ?? '类'}·${dish.toppingBinding.itemIds.length}道`;
      parts.push(
        `${dish.toppingBinding.required ? '浇头必选' : '浇头可选'} · ${scope}`,
      );
    }
    return parts.length ? parts.join(' · ') : '未关联口味/浇头';
  }

  const categoryItems = useMemo(() => {
    if (!editDraft?.toppingCategoryId) return [];
    return dishes.filter(
      (d) =>
        d.categoryId === editDraft.toppingCategoryId &&
        d.id !== editDraft.dishId &&
        d.available,
    );
  }, [dishes, editDraft]);

  const canSaveTopping =
    !editDraft?.toppingEnabled ||
    (Boolean(editDraft.toppingCategoryId) &&
      (editDraft.toppingAllInCategory || editDraft.toppingItemIds.length > 0));

  return (
    <div>
      <p className="mb-3 text-[13px] leading-relaxed text-brand-text-muted">
        在<strong>菜品编辑</strong>里关联口味与浇头；口味分组在旁边 Tab 维护。
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setManageTab('items')}
          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
            manageTab === 'items'
              ? 'border-brand-gold/40 bg-brand-gold/15 font-medium text-brand-gold'
              : 'border-brand-border text-brand-text-muted hover:text-brand-text'
          }`}
        >
          菜品
        </button>
        <button
          type="button"
          onClick={() => setManageTab('flavor_groups')}
          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
            manageTab === 'flavor_groups'
              ? 'border-brand-gold/40 bg-brand-gold/15 font-medium text-brand-gold'
              : 'border-brand-border text-brand-text-muted hover:text-brand-text'
          }`}
        >
          口味分组
        </button>
      </div>

      {manageTab === 'items' ? (
        <div className="space-y-2">
          {editableDishes.map((dish) => {
            const cat = DEMO_CATEGORIES.find((c) => c.id === dish.categoryId);
            return (
              <div
                key={dish.id}
                className="flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-card px-3 py-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-bg text-xl">
                  {dish.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{dish.name}</p>
                  <p className="truncate text-[12px] text-brand-text-muted">
                    {cat?.name ?? '—'} · {money(dish.price)} · {bindingSummary(dish)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(dish)}
                  className="shrink-0 text-sm font-medium text-brand-gold"
                >
                  编辑
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-border bg-brand-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">口味分组（全店共用）</h2>
              <p className="mt-1 text-[12px] text-brand-text-muted">
                先建组与口味，再到菜品编辑里勾选。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPrompt({ kind: 'group' })}
              className="shrink-0 text-sm text-brand-gold"
            >
              + 分组
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {flavorGroups.map((g) => (
              <div key={g.id} className="rounded-xl border border-brand-border bg-brand-bg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{g.name}</p>
                  <button
                    type="button"
                    className="text-[12px] text-brand-gold"
                    onClick={() => setPrompt({ kind: 'option', groupId: g.id })}
                  >
                    + 口味
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.options.map((o) => (
                    <span
                      key={o.id}
                      className="rounded-full border border-brand-border px-2.5 py-1 text-[12px]"
                    >
                      {o.name}
                    </span>
                  ))}
                  {g.options.length === 0 ? (
                    <span className="text-[12px] text-brand-text-muted">暂无口味</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={editDraft != null && editingDish != null}
        onClose={closeEdit}
        title={editingDish ? `编辑菜品 · ${editingDish.name}` : '编辑菜品'}
        size="lg"
        footer={
          <ModalConfirmActions
            cancelLabel="取消"
            confirmLabel="保存"
            onCancel={closeEdit}
            onConfirm={saveEdit}
            confirmDisabled={!canSaveTopping}
          />
        }
      >
        {editingDish && editDraft ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-border bg-brand-bg/40 p-4">
              <p className="text-sm text-brand-text-muted">基本信息（演示只读）</p>
              <p className="mt-1 text-base font-semibold">
                {editingDish.emoji} {editingDish.name}
              </p>
              <p className="mt-1 text-sm text-brand-gold">{money(editingDish.price)}</p>
            </div>

            <div className="rounded-xl border border-brand-border bg-brand-bg/40 p-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="text-sm font-medium text-brand-text">口味分组</p>
                <button
                  type="button"
                  className="text-xs text-brand-gold underline-offset-2 hover:underline sm:text-sm"
                  onClick={() => {
                    closeEdit();
                    setManageTab('flavor_groups');
                  }}
                >
                  管理口味分组
                </button>
              </div>
              <p className="mb-3 mt-1 text-[13px] text-brand-text-muted">
                勾选本菜要用的项；顾客每组单选必选一。
              </p>
              <div className="space-y-3">
                {flavorGroups.map((g) => {
                  const bound = editDraft.flavorBindings.find((b) => b.groupId === g.id);
                  return (
                    <div
                      key={g.id}
                      className="rounded-xl border border-brand-border bg-brand-card p-3"
                    >
                      <p className="text-[13px] font-medium">{g.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {g.options.map((o) => {
                          const on = bound?.optionIds.includes(o.id) ?? false;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => toggleFlavorOption(g.id, o.id)}
                              className={`px-2.5 py-1 text-[13px] ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(on)}`}
                            >
                              {o.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-brand-border bg-brand-bg/40 p-4">
              <p className="text-sm font-medium text-brand-text">浇头</p>
              <p className="mt-1 text-[13px] text-brand-text-muted">
                挑选一个类别，再在该类下勾菜（或全选本类）。
              </p>

              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-brand-gold,#c9a227)]"
                  checked={editDraft.toppingEnabled}
                  onChange={(e) =>
                    setEditDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            toppingEnabled: e.target.checked,
                            toppingCategoryId: e.target.checked ? prev.toppingCategoryId : '',
                            toppingItemIds: [],
                            toppingAllInCategory: false,
                          }
                        : prev,
                    )
                  }
                />
                启用浇头
              </label>

              {editDraft.toppingEnabled ? (
                <>
                  <div className="mt-4">
                    <p className="text-[13px] font-medium text-brand-text">是否必选</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditDraft((p) => (p ? { ...p, toppingRequired: false } : p))
                        }
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                          !editDraft.toppingRequired
                            ? 'border-brand-gold bg-brand-gold/15 text-brand-gold'
                            : 'border-brand-border bg-brand-card text-brand-text-muted'
                        }`}
                      >
                        可选
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditDraft((p) => (p ? { ...p, toppingRequired: true } : p))
                        }
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                          editDraft.toppingRequired
                            ? 'border-brand-gold bg-brand-gold/15 text-brand-gold'
                            : 'border-brand-border bg-brand-card text-brand-text-muted'
                        }`}
                      >
                        必选
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block">
                      <span className="text-[13px] font-medium text-brand-text">挑选类别</span>
                      <select
                        className={DEMO_SELECT_CLASS}
                        value={editDraft.toppingCategoryId}
                        onChange={(e) => setToppingCategory(e.target.value)}
                      >
                        <option value="">请选择一个类别…</option>
                        {DEMO_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {editDraft.toppingCategoryId ? (
                    <div className="mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-brand-text">
                          该类下的菜
                          <span className="ml-2 text-[11px] font-normal text-brand-text-muted">
                            {editDraft.toppingAllInCategory
                              ? `全部 ${categoryItems.length} 道`
                              : `已勾 ${editDraft.toppingItemIds.length}/${categoryItems.length}`}
                          </span>
                        </p>
                        <div className="flex gap-2 text-[12px]">
                          <button
                            type="button"
                            className="text-brand-gold"
                            onClick={selectAllInCategory}
                          >
                            全选本类
                          </button>
                          <button
                            type="button"
                            className="text-brand-text-muted"
                            onClick={clearSelection}
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      {!editDraft.toppingAllInCategory &&
                      editDraft.toppingItemIds.length === 0 ? (
                        <p className="mt-1 text-[12px] text-red-500">
                          请勾菜，或点「全选本类」
                        </p>
                      ) : null}
                      {categoryItems.length === 0 ? (
                        <p className="mt-2 text-[13px] text-brand-text-muted">该类暂无其他菜</p>
                      ) : (
                        <ul className="mt-2 divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border">
                          {categoryItems.map((item) => {
                            const on = isItemOn(item.id);
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => toggleToppingItem(item.id)}
                                  className="flex w-full items-center gap-3 bg-brand-card px-3 py-2.5 text-left hover:bg-brand-gold/5"
                                >
                                  <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${
                                      on
                                        ? 'border-brand-gold bg-brand-gold text-brand-on-gold'
                                        : 'border-brand-border bg-brand-bg text-transparent'
                                    }`}
                                  >
                                    ✓
                                  </span>
                                  <span className="min-w-0 flex-1 text-sm">
                                    {item.emoji} {item.name}
                                  </span>
                                  <span className="text-sm text-brand-gold">
                                    {money(item.price)}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <PromptModal
        open={prompt != null}
        onClose={() => setPrompt(null)}
        title={prompt?.kind === 'option' ? '新增口味' : '新增口味分组'}
        label={prompt?.kind === 'option' ? '口味名称' : '分组名称'}
        placeholder={prompt?.kind === 'option' ? '例如：微甜' : '例如：忌口'}
        submitLabel="添加"
        cancelLabel="取消"
        onSubmit={(value) => {
          if (prompt?.kind === 'option') onAddFlavorOption(prompt.groupId, value);
          else if (prompt?.kind === 'group') onAddFlavorGroup(value);
          setPrompt(null);
        }}
      />
    </div>
  );
}
