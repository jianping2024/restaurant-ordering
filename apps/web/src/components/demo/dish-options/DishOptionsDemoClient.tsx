'use client';

import { useMemo, useState } from 'react';
import {
  CUSTOMER_MENU_ITEM_LIST_CLASS,
  CUSTOMER_MENU_ITEM_LIST_HOST_CLASS,
  MENU_ITEM_CARD_ACTION_GLYPH_CLASS,
  MENU_ITEM_CARD_ACTION_SLOT_CLASS,
  MENU_ITEM_CARD_BODY_CLASS,
  MENU_ITEM_CARD_GOLD_ACTION_CLASS,
  MENU_ITEM_CARD_NAME_CLASS,
  MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS,
  MENU_ITEM_CARD_PRICE_CLASS,
  MENU_ITEM_CARD_SHELL_CLASS,
  MENU_ITEM_CARD_THUMB_CLASS,
} from '@/lib/menu-item-card-layout';
import {
  CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS,
  customerMenuItemDetailBackdropClass,
  customerMenuItemDetailBodyClass,
  customerMenuItemDetailCloseButtonClass,
  customerMenuItemDetailContentClass,
  customerMenuItemDetailFooterClass,
  customerMenuItemDetailFooterRowClass,
  customerMenuItemDetailHostClass,
  customerMenuItemDetailPanelClass,
  customerMenuItemDetailPanelEnteredClass,
} from '@/lib/customer-menu-item-detail-layout';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { CustomerMenuBottomSheet } from '@/components/menu/CustomerMenuBottomSheet';
import { CustomerCartItemNoteFields } from '@/components/menu/CustomerCartItemNoteFields';
import { mesaSelectionChipShellClass, mesaSelectionChipSoftClass } from '@/lib/mesa-selection-chip';
import { customerMenuBottomBarDockClass } from '@/lib/customer-menu-bottom-bar-layout';
import {
  composeCartLineNote,
  toggleCartNotePresetSelection,
} from '@/lib/menu-note-presets';
import {
  DEMO_CATEGORIES,
  DEMO_DISHES,
  DEMO_FLAVOR_GROUPS,
  DEMO_NOTE_PRESET_CATALOG,
  type DemoCartLine,
  type DemoDish,
  type DemoFlavorGroup,
  type DemoToppingPick,
  dishNeedsConfig,
  flavorsSatisfied,
  lineConfigKey,
  lineUnitPrice,
  mintLineId,
  money,
  resolveFlavorOptionsForDish,
  resolveToppingDishesForDish,
  toppingsSatisfied,
} from '@/lib/demo-dish-options-catalog';
import { DemoMenuManagePanel } from '@/components/demo/dish-options/DemoMenuManagePanel';

type Tab = 'order' | 'config';

function cloneDishes(src: DemoDish[]): DemoDish[] {
  return src.map((d) => ({
    ...d,
    flavorBindings: d.flavorBindings.map((b) => ({
      ...b,
      optionIds: [...b.optionIds],
    })),
    toppingBinding: d.toppingBinding
      ? {
          categoryId: d.toppingBinding.categoryId,
          itemIds: [...d.toppingBinding.itemIds],
          required: d.toppingBinding.required,
        }
      : null,
    notePresetGroupIds: [...d.notePresetGroupIds],
  }));
}

function cartLineKey(line: Pick<
  DemoCartLine,
  'dishId' | 'flavorPicks' | 'toppings' | 'note' | 'selectedNotePresetIds'
>): string {
  return lineConfigKey({
    dishId: line.dishId,
    flavorPicks: line.flavorPicks,
    toppings: line.toppings,
    note: line.note,
    selectedNotePresetIds: line.selectedNotePresetIds,
  });
}

function cloneGroups(src: DemoFlavorGroup[]): DemoFlavorGroup[] {
  return src.map((g) => ({
    ...g,
    options: g.options.map((o) => ({ ...o })),
  }));
}

export function DishOptionsDemoClient() {
  const [tab, setTab] = useState<Tab>('order');
  const [dishes, setDishes] = useState(() => cloneDishes(DEMO_DISHES));
  const [flavorGroups, setFlavorGroups] = useState(() => cloneGroups(DEMO_FLAVOR_GROUPS));
  const [activeCategoryId, setActiveCategoryId] = useState(DEMO_CATEGORIES[0]!.id);
  const [cart, setCart] = useState<DemoCartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [detailDishId, setDetailDishId] = useState<string | null>(null);
  const [draftFlavors, setDraftFlavors] = useState<Record<string, string>>({});
  const [draftToppings, setDraftToppings] = useState<DemoToppingPick[]>([]);
  const [draftNote, setDraftNote] = useState('');
  const [draftNotePresets, setDraftNotePresets] = useState<string[]>([]);
  const [draftWarn, setDraftWarn] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<DemoCartLine[]>([]);

  const detailDish = detailDishId ? dishes.find((d) => d.id === detailDishId) ?? null : null;

  const listDishes = useMemo(
    () => dishes.filter((d) => d.categoryId === activeCategoryId && d.available),
    [dishes, activeCategoryId],
  );

  const qtyByDish = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) {
      map.set(line.dishId, (map.get(line.dishId) ?? 0) + line.qty);
    }
    return map;
  }, [cart]);

  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = cart.reduce((sum, line) => {
    const dish = dishes.find((d) => d.id === line.dishId);
    if (!dish) return sum;
    return sum + lineUnitPrice(dish, line.toppings, dishes) * line.qty;
  }, 0);

  function openDetail(dish: DemoDish) {
    setDetailDishId(dish.id);
    setDraftFlavors({});
    setDraftToppings([]);
    setDraftNote('');
    setDraftNotePresets([]);
    setDraftWarn('');
  }

  function closeDetail() {
    setDetailDishId(null);
    setDraftWarn('');
  }

  function addPlain(dishId: string, delta: number) {
    const dish = dishes.find((d) => d.id === dishId);
    if (!dish || dishNeedsConfig(dish)) return;

    setCart((prev) => {
      const emptyKey = lineConfigKey({
        dishId,
        flavorPicks: {},
        toppings: [],
        note: '',
        selectedNotePresetIds: [],
      });
      const idx = prev.findIndex((l) => cartLineKey(l) === emptyKey);
      if (delta > 0) {
        if (idx >= 0) {
          const next = [...prev];
          const line = next[idx]!;
          next[idx] = { ...line, qty: line.qty + delta };
          return next;
        }
        return [
          ...prev,
          {
            lineId: mintLineId(),
            dishId,
            flavorPicks: {},
            toppings: [],
            note: '',
            selectedNotePresetIds: [],
            qty: delta,
          },
        ];
      }
      if (idx < 0) return prev;
      const next = [...prev];
      const line = next[idx]!;
      const qty = line.qty + delta;
      if (qty <= 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx] = { ...line, qty };
      return next;
    });
  }

  function confirmDetail() {
    if (!detailDish) return;
    if (!flavorsSatisfied(detailDish, draftFlavors, flavorGroups)) {
      setDraftWarn('请为每个口味分组选一项。');
      return;
    }
    if (!toppingsSatisfied(detailDish, draftToppings)) {
      setDraftWarn('此菜浇头为必选：请至少选一种并设置数量。');
      return;
    }
    const toppings = draftToppings.filter((t) => t.qty > 0);
    const note = draftNote.trim();
    const selectedNotePresetIds = [...draftNotePresets];
    const key = lineConfigKey({
      dishId: detailDish.id,
      flavorPicks: draftFlavors,
      toppings,
      note,
      selectedNotePresetIds,
    });
    setCart((prev) => {
      const idx = prev.findIndex((l) => cartLineKey(l) === key);
      if (idx >= 0) {
        const next = [...prev];
        const line = next[idx]!;
        next[idx] = { ...line, qty: line.qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          lineId: mintLineId(),
          dishId: detailDish.id,
          flavorPicks: { ...draftFlavors },
          toppings,
          note,
          selectedNotePresetIds,
          qty: 1,
        },
      ];
    });
    closeDetail();
  }

  function bumpConfiguredLine(lineId: string, delta: number) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.lineId === lineId);
      if (idx < 0) return prev;
      const next = [...prev];
      const line = next[idx]!;
      const qty = line.qty + delta;
      if (qty <= 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx] = { ...line, qty };
      return next;
    });
  }

  function setToppingQty(itemId: string, qty: number) {
    setDraftToppings((prev) => {
      const q = Math.max(0, Math.min(99, Math.floor(qty)));
      const idx = prev.findIndex((t) => t.itemId === itemId);
      if (q <= 0) {
        if (idx < 0) return prev;
        return prev.filter((t) => t.itemId !== itemId);
      }
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { itemId, qty: q };
        return next;
      }
      return [...prev, { itemId, qty: q }];
    });
    setDraftWarn('');
  }

  function formatLineSummary(line: DemoCartLine): string {
    const parts: string[] = [];
    for (const [groupId, optionId] of Object.entries(line.flavorPicks)) {
      const g = flavorGroups.find((x) => x.id === groupId);
      const o = g?.options.find((x) => x.id === optionId);
      if (g && o) parts.push(`${g.name}·${o.name}`);
    }
    for (const t of line.toppings) {
      const d = dishes.find((x) => x.id === t.itemId);
      if (d) parts.push(`${d.name}×${t.qty}`);
    }
    const composed = composeCartLineNote({
      freeText: line.note,
      selectedNotePresetIds: line.selectedNotePresetIds,
      catalog: DEMO_NOTE_PRESET_CATALOG,
      lang: 'zh',
    });
    if (composed) parts.push(`备注:${composed}`);
    return parts.length ? parts.join(' · ') : '无选项';
  }

  function updateCartLineNote(lineId: string, note: string) {
    setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, note } : l)));
  }

  function toggleCartLineNotePreset(lineId: string, presetId: string) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        return {
          ...l,
          selectedNotePresetIds: toggleCartNotePresetSelection(
            l.selectedNotePresetIds,
            DEMO_NOTE_PRESET_CATALOG,
            presetId,
          ),
        };
      }),
    );
  }

  function submitDemoOrder() {
    setSubmittedSnapshot(cart.map((l) => ({ ...l, toppings: [...l.toppings], selectedNotePresetIds: [...l.selectedNotePresetIds], flavorPicks: { ...l.flavorPicks } })));
    setSubmitted(true);
    setCartOpen(false);
  }

  function saveDishBindings(
    dishId: string,
    next: Pick<DemoDish, 'flavorBindings' | 'toppingBinding'>,
  ) {
    setDishes((prev) =>
      prev.map((d) =>
        d.id === dishId
          ? {
              ...d,
              flavorBindings: next.flavorBindings.map((b) => ({
                groupId: b.groupId,
                optionIds: [...b.optionIds],
              })),
              toppingBinding: next.toppingBinding
                ? {
                    categoryId: next.toppingBinding.categoryId,
                    itemIds: [...next.toppingBinding.itemIds],
                    required: next.toppingBinding.required,
                  }
                : null,
            }
          : d,
      ),
    );
  }

  function addFlavorOption(groupId: string, name: string) {
    const id = `opt-${Date.now()}`;
    setFlavorGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, options: [...g.options, { id, name: name.trim() }] }
          : g,
      ),
    );
  }

  function addFlavorGroup(name: string) {
    setFlavorGroups((prev) => [
      ...prev,
      { id: `fg-${Date.now()}`, name: name.trim(), options: [] },
    ]);
  }

  const detailUnit =
    detailDish != null
      ? lineUnitPrice(detailDish, draftToppings.filter((t) => t.qty > 0), dishes)
      : 0;

  return (
    <div className="min-h-dvh bg-brand-bg text-brand-text">
      <header className="sticky top-0 z-20 border-b border-brand-border bg-brand-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-brand-gold">Demo · 非真实下单</p>
            <h1 className="text-base font-semibold">口味分组 + 浇头关联</h1>
          </div>
          <div className="flex rounded-full border border-brand-border bg-brand-card p-0.5 text-sm">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 ${tab === 'order' ? 'bg-brand-gold text-brand-on-gold' : 'text-brand-text-muted'}`}
              onClick={() => setTab('order')}
            >
              顾客点餐
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 ${tab === 'config' ? 'bg-brand-gold text-brand-on-gold' : 'text-brand-text-muted'}`}
              onClick={() => setTab('config')}
            >
              菜单管理
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto max-w-3xl px-4 ${tab === 'order' ? 'pb-28 pt-4' : 'pb-10 pt-4'}`}>
        {tab === 'order' ? (
          <>
            <p className="mb-3 text-[13px] leading-relaxed text-brand-text-muted">
              无口味/浇头的菜：列表直接加减。有配置的菜：点加号进详情；袋内再加份复制已选；选项或备注不同则分行。
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {DEMO_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategoryId(c.id)}
                  className={`${mesaSelectionChipShellClass} px-3 py-1.5 text-sm ${
                    activeCategoryId === c.id
                      ? 'border-brand-gold bg-brand-gold text-brand-on-gold'
                      : 'border-brand-border bg-brand-card text-brand-text-muted'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className={CUSTOMER_MENU_ITEM_LIST_HOST_CLASS}>
              <div className={CUSTOMER_MENU_ITEM_LIST_CLASS}>
                {listDishes.map((dish) => {
                  const needs = dishNeedsConfig(dish);
                  const qty = qtyByDish.get(dish.id) ?? 0;
                  return (
                    <DemoListCard
                      key={dish.id}
                      dish={dish}
                      qty={qty}
                      needsConfig={needs}
                      onOpenDetail={() => openDetail(dish)}
                      onIncrement={() => {
                        if (needs) openDetail(dish);
                        else addPlain(dish.id, 1);
                      }}
                      onDecrement={() => {
                        if (needs) {
                          if (qty > 0) setCartOpen(true);
                          return;
                        }
                        addPlain(dish.id, -1);
                      }}
                    />
                  );
                })}
              </div>
            </div>
            {listDishes.length === 0 ? (
              <p className="py-10 text-center text-sm text-brand-text-muted">该分类暂无菜品</p>
            ) : null}
          </>
        ) : (
          <DemoMenuManagePanel
            dishes={dishes}
            flavorGroups={flavorGroups}
            onSaveDishBindings={saveDishBindings}
            onAddFlavorGroup={addFlavorGroup}
            onAddFlavorOption={addFlavorOption}
          />
        )}
      </main>

      {tab === 'order' ? (
        <div className={customerMenuBottomBarDockClass} data-mesa-bottom-dock="">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-brand-border bg-brand-card text-lg"
              aria-label="打开购物袋"
            >
              🛍️
              {cartCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-[11px] font-bold text-brand-on-gold">
                  {cartCount}
                </span>
              ) : null}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-brand-text-muted">
                {cartCount > 0 ? `${cartCount} 份 · ${money(cartTotal)}` : '购物袋是空的'}
              </p>
            </div>
            <button
              type="button"
              disabled={cartCount === 0}
              onClick={submitDemoOrder}
              className="rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-on-gold disabled:opacity-40"
            >
              演示下单
            </button>
          </div>
        </div>
      ) : null}

      {detailDish ? (
        <DetailSheet
          dish={detailDish}
          dishes={dishes}
          flavorGroups={flavorGroups}
          draftFlavors={draftFlavors}
          draftToppings={draftToppings}
          draftNote={draftNote}
          draftNotePresets={draftNotePresets}
          draftWarn={draftWarn}
          unitPrice={detailUnit}
          onClose={closeDetail}
          onPickFlavor={(groupId, optionId) => {
            setDraftFlavors((prev) => ({ ...prev, [groupId]: optionId }));
            setDraftWarn('');
          }}
          onSetToppingQty={setToppingQty}
          onNote={setDraftNote}
          onToggleNotePreset={(presetId) => {
            setDraftNotePresets((prev) =>
              toggleCartNotePresetSelection(prev, DEMO_NOTE_PRESET_CATALOG, presetId),
            );
          }}
          onConfirm={confirmDetail}
        />
      ) : null}

      <CustomerMenuBottomSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="购物袋"
        footer={
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={submitDemoOrder}
            className="w-full rounded-xl bg-brand-gold py-3 text-sm font-semibold text-brand-on-gold disabled:opacity-40"
          >
            演示下单 · {money(cartTotal)}
          </button>
        }
      >
        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-brand-text-muted">还没有菜</p>
        ) : (
          <ul className="space-y-3 pb-2">
            {cart.map((line) => {
              const dish = dishes.find((d) => d.id === line.dishId);
              if (!dish) return null;
              const unit = lineUnitPrice(dish, line.toppings, dishes);
              return (
                <li
                  key={line.lineId}
                  className="rounded-2xl border border-brand-border bg-brand-card p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {dish.emoji} {dish.name}
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-brand-text-muted">
                        {formatLineSummary(line)}
                      </p>
                      <p className={`mt-1 text-sm ${CUSTOMER_MENU_TYPE.moneyAmount}`}>
                        {money(unit)} / 份
                      </p>
                    </div>
                    <CartQtyStepper
                      qty={line.qty}
                      density="compact"
                      onDecrement={() => bumpConfiguredLine(line.lineId, -1)}
                      onIncrement={() => bumpConfiguredLine(line.lineId, 1)}
                    />
                  </div>
                  <div className="mt-3">
                    <CustomerCartItemNoteFields
                      lang="zh"
                      notePresetCatalog={DEMO_NOTE_PRESET_CATALOG}
                      notePresetGroupIds={dish.notePresetGroupIds}
                      selectedNotePresetIds={line.selectedNotePresetIds}
                      note={line.note}
                      onUpdateNote={(note) => updateCartLineNote(line.lineId, note)}
                      onToggleNotePreset={(presetId) =>
                        toggleCartLineNotePreset(line.lineId, presetId)
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CustomerMenuBottomSheet>

      {submitted ? (
        <div className={customerMenuItemDetailHostClass}>
          <button
            type="button"
            className={customerMenuItemDetailBackdropClass}
            aria-label="关闭"
            onClick={() => setSubmitted(false)}
          />
          <div
            className={`${customerMenuItemDetailPanelClass} ${customerMenuItemDetailPanelEnteredClass} max-lg:max-h-[70vh] lg:max-h-[min(80vh,28rem)]`}
          >
            <div className={`${customerMenuItemDetailBodyClass} p-5`}>
              <p className="text-brand-gold text-sm font-medium">演示完成</p>
              <h2 className="mt-1 text-xl font-semibold">已模拟提交购物袋</h2>
              <p className="mt-2 text-sm text-brand-text-muted">
                未写真实订单。可继续改配置或再点几道菜验证分行规则。
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {submittedSnapshot.map((line) => {
                  const dish = dishes.find((d) => d.id === line.dishId);
                  if (!dish) return null;
                  const composed = composeCartLineNote({
                    freeText: line.note,
                    selectedNotePresetIds: line.selectedNotePresetIds,
                    catalog: DEMO_NOTE_PRESET_CATALOG,
                    lang: 'zh',
                  });
                  return (
                    <li key={line.lineId} className="rounded-xl bg-brand-card px-3 py-2 border border-brand-border">
                      <span className="font-medium">
                        {dish.name} ×{line.qty}
                      </span>
                      <span className="block text-[12px] text-brand-text-muted">
                        {formatLineSummary(line)}
                      </span>
                      <span className="mt-1 block text-[12px] text-brand-text">
                        备注：{composed || '（无）'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className={customerMenuItemDetailFooterClass}>
              <button
                type="button"
                className="w-full rounded-xl bg-brand-gold py-3 text-sm font-semibold text-brand-on-gold"
                onClick={() => {
                  setSubmitted(false);
                  setSubmittedSnapshot([]);
                  setCart([]);
                }}
              >
                清空并继续演示
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function DemoListCard({
  dish,
  qty,
  needsConfig,
  onOpenDetail,
  onIncrement,
  onDecrement,
}: {
  dish: DemoDish;
  qty: number;
  needsConfig: boolean;
  onOpenDetail: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <article
      className={`${MENU_ITEM_CARD_SHELL_CLASS} border-brand-border p-3 rounded-xl gap-3`}
    >
      <button
        type="button"
        className={`${MENU_ITEM_CARD_THUMB_CLASS} bg-brand-bg text-3xl`}
        onClick={onOpenDetail}
        aria-label={`打开 ${dish.name}`}
      >
        {dish.emoji}
      </button>
      <div className={MENU_ITEM_CARD_BODY_CLASS}>
        <button type="button" className="min-w-0 text-left" onClick={onOpenDetail}>
          <h3 className={MENU_ITEM_CARD_NAME_CLASS}>{dish.name}</h3>
          {needsConfig ? (
            <p className="mt-0.5 text-[11px] text-brand-gold">需选口味/浇头</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-brand-text-muted">列表可直接加减</p>
          )}
        </button>
        <div className={MENU_ITEM_CARD_PRICE_ACTION_ROW_CLASS}>
          <p className={`${MENU_ITEM_CARD_PRICE_CLASS} ${CUSTOMER_MENU_TYPE.moneyAmount}`}>
            {money(dish.price)}
          </p>
          <div className={MENU_ITEM_CARD_ACTION_SLOT_CLASS}>
            {qty > 0 && !needsConfig ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="减一份"
                  onClick={onDecrement}
                  className={`${MENU_ITEM_CARD_GOLD_ACTION_CLASS} ${CUSTOMER_MENU_TYPE.itemAction}`}
                >
                  <span className={MENU_ITEM_CARD_ACTION_GLYPH_CLASS}>−</span>
                </button>
                <span className="min-w-[1.25rem] text-center text-sm font-semibold">{qty}</span>
                <button
                  type="button"
                  aria-label="加一份"
                  onClick={onIncrement}
                  className={`${MENU_ITEM_CARD_GOLD_ACTION_CLASS} ${CUSTOMER_MENU_TYPE.itemAction}`}
                >
                  <span className={MENU_ITEM_CARD_ACTION_GLYPH_CLASS}>+</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label={needsConfig ? `配置并添加 ${dish.name}` : `添加 ${dish.name}`}
                onClick={onIncrement}
                className={`${MENU_ITEM_CARD_GOLD_ACTION_CLASS} ${CUSTOMER_MENU_TYPE.itemAction} relative`}
              >
                <span className={MENU_ITEM_CARD_ACTION_GLYPH_CLASS}>+</span>
                {needsConfig && qty > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-text px-0.5 text-[10px] text-brand-bg">
                    {qty}
                  </span>
                ) : null}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function DetailSheet({
  dish,
  dishes,
  flavorGroups,
  draftFlavors,
  draftToppings,
  draftNote,
  draftNotePresets,
  draftWarn,
  unitPrice,
  onClose,
  onPickFlavor,
  onSetToppingQty,
  onNote,
  onToggleNotePreset,
  onConfirm,
}: {
  dish: DemoDish;
  dishes: DemoDish[];
  flavorGroups: DemoFlavorGroup[];
  draftFlavors: Record<string, string>;
  draftToppings: DemoToppingPick[];
  draftNote: string;
  draftNotePresets: string[];
  draftWarn: string;
  unitPrice: number;
  onClose: () => void;
  onPickFlavor: (groupId: string, optionId: string) => void;
  onSetToppingQty: (itemId: string, qty: number) => void;
  onNote: (note: string) => void;
  onToggleNotePreset: (presetId: string) => void;
  onConfirm: () => void;
}) {
  const flavorSections = resolveFlavorOptionsForDish(dish, flavorGroups);
  const toppingItems = resolveToppingDishesForDish(dish, dishes);
  const needs = dishNeedsConfig(dish);

  return (
    <div className={customerMenuItemDetailHostClass}>
      <button type="button" className={customerMenuItemDetailBackdropClass} aria-label="关闭" onClick={onClose} />
      <div className={`${customerMenuItemDetailPanelClass} ${customerMenuItemDetailPanelEnteredClass}`}>
        <button type="button" className={customerMenuItemDetailCloseButtonClass} onClick={onClose} aria-label="关闭">
          ✕
        </button>
        <div className={customerMenuItemDetailBodyClass}>
          <div className={`${CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS} flex items-center justify-center text-6xl`}>
            {dish.emoji}
          </div>
          <div className={customerMenuItemDetailContentClass}>
            <h2 className="text-xl font-semibold">{dish.name}</h2>
            <p className={`mt-1 ${CUSTOMER_MENU_TYPE.moneyAmount}`}>{money(dish.price)} 起</p>

            {flavorSections.map(({ group, options }) => (
              <section key={group.id} className="mt-5">
                <h3 className="text-sm font-semibold">
                  {group.name}
                  <span className="ml-2 text-[11px] font-normal text-red-500">必选 · 单选</span>
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {options.map((o) => {
                    const on = draftFlavors[group.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => onPickFlavor(group.id, o.id)}
                        className={`${mesaSelectionChipShellClass} px-3 py-1.5 text-sm ${mesaSelectionChipSoftClass(on)}`}
                      >
                        {o.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            {dish.toppingBinding ? (
              <section className="mt-5">
                <h3 className="text-sm font-semibold">
                  浇头
                  <span
                    className={`ml-2 text-[11px] font-normal ${
                      dish.toppingBinding.required ? 'text-red-500' : 'text-brand-text-muted'
                    }`}
                  >
                    {dish.toppingBinding.required ? '必选' : '可选'} · 可多选改数量
                  </span>
                </h3>
                <ul className="mt-2 space-y-2">
                  {toppingItems.map((item) => {
                    const qty = draftToppings.find((t) => t.itemId === item.id)?.qty ?? 0;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-card px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {item.emoji} {item.name}
                          </p>
                          <p className={`text-[12px] ${CUSTOMER_MENU_TYPE.moneyAmount}`}>
                            {money(item.price)}
                          </p>
                        </div>
                        <CartQtyStepper
                          qty={qty}
                          density="compact"
                          onDecrement={() => onSetToppingQty(item.id, qty - 1)}
                          onIncrement={() => onSetToppingQty(item.id, qty + 1)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold">备注</h3>
              <CustomerCartItemNoteFields
                lang="zh"
                notePresetCatalog={DEMO_NOTE_PRESET_CATALOG}
                notePresetGroupIds={dish.notePresetGroupIds}
                selectedNotePresetIds={draftNotePresets}
                note={draftNote}
                onUpdateNote={onNote}
                onToggleNotePreset={onToggleNotePreset}
              />
            </section>

            {draftWarn ? (
              <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] text-red-600">
                {draftWarn}
              </p>
            ) : null}

            {!needs ? (
              <p className="mt-4 text-[13px] text-brand-text-muted">
                此菜未挂口味/浇头；演示里也可从详情加入（与列表加减等价）。
              </p>
            ) : null}
          </div>
        </div>
        <div className={customerMenuItemDetailFooterClass}>
          <div className={customerMenuItemDetailFooterRowClass}>
            <div>
              <p className="text-[12px] text-brand-text-muted">本份合计</p>
              <p className={`text-lg font-semibold ${CUSTOMER_MENU_TYPE.moneyAmount}`}>
                {money(unitPrice)}
              </p>
            </div>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-on-gold"
            >
              加入购物袋
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
