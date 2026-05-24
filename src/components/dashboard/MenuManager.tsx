'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Tree from 'rc-tree';
import type { DataNode } from 'rc-tree/lib/interface';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { normalizeDecimalInput } from '@/lib/number-input';
import type { MenuCategory, MenuItem, PrintStation } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  compressMenuImageForUpload,
  MENU_IMAGE_ACCEPT,
  menuImageObjectPath,
  removeMenuImageFromStorage,
  validateMenuImageFile,
} from '@/lib/menu-image';
import {
  NOTE_PRESETS,
  NOTE_PRESET_GROUP_LABELS,
  type NotePresetGroup,
} from '@/lib/note-presets';
import { normalizeMenuItemCode } from '@/lib/menu-print-label';
import { resolveEffectivePrintStationId } from '@/lib/print-station-resolve';
import 'rc-tree/assets/index.css';

const FOOD_EMOJIS = ['🍽️', '🍞', '🥗', '🥣', '🐟', '🥚', '🍗', '🐙', '🥩', '🦆', '🫒', '🍷', '🍺', '💧', '☕', '🥧', '🍮', '🫕', '🥘', '🍲'];

interface MenuManagerProps {
  restaurantId: string;
  initialItems: MenuItem[];
  initialCategories: MenuCategory[];
  initialPrintStations: PrintStation[];
  embedded?: boolean;
}

type ItemForm = {
  name_pt: string;
  name_en: string;
  name_zh: string;
  description_pt: string;
  description_en: string;
  price: string;
  category_id: string;
  item_code: string;
  print_station_id: string;
  emoji: string;
  available: boolean;
  note_preset_keys: string[];
};

const defaultItemForm: ItemForm = {
  name_pt: '',
  name_en: '',
  name_zh: '',
  description_pt: '',
  description_en: '',
  price: '',
  category_id: '',
  item_code: '',
  print_station_id: '',
  emoji: '🍽️',
  available: true,
  note_preset_keys: [],
};

type CategoryDraft = {
  name_pt: string;
  name_en: string;
  name_zh: string;
  item_code: string;
  print_station_id: string;
};

const defaultCategoryDraft: CategoryDraft = {
  name_pt: '',
  name_en: '',
  name_zh: '',
  item_code: '',
  print_station_id: '',
};

type ConfirmDialogState =
  | { open: false }
  | {
      open: true;
      title: string;
      message: string;
      intent: 'delete_item' | 'delete_category' | 'ack';
      itemId?: string;
      categoryId?: string;
    };

const NOTE_UI_TEXT = {
  zh: { title: '预选备注', hint: '可选。顾客下单时会显示这些快捷备注，建议按菜品类型勾选。' },
  en: { title: 'Preset notes', hint: 'Optional. Selected notes are shown as quick options during ordering.' },
  pt: { title: 'Observacoes predefinidas', hint: 'Opcional. Estas observacoes aparecem como atalhos no pedido.' },
} as const;

export function MenuManager({
  restaurantId,
  initialItems,
  initialCategories,
  initialPrintStations,
  embedded,
}: MenuManagerProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).menuManager;
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories);
  const [printStations, setPrintStations] = useState<PrintStation[]>(initialPrintStations);

  useEffect(() => {
    setPrintStations(initialPrintStations);
  }, [initialPrintStations]);

  const [selectedTopCategoryId, setSelectedTopCategoryId] = useState('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('');
  const [showAllMenuItemTypes, setShowAllMenuItemTypes] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<string[]>([]);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(defaultCategoryDraft);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [categoryPanelMode, setCategoryPanelMode] = useState<'none' | 'edit' | 'create-child' | 'create-root'>('none');

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(defaultItemForm);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState('');
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [stripImage, setStripImage] = useState(false);
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ open: false });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const MAX_CATEGORY_DEPTH = 5;

  const noteUi = NOTE_UI_TEXT[lang];

  const topCategories = useMemo(
    () => categories.filter((c) => !c.parent_id && c.active).sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );
  const selectedTopId = topCategories.some((c) => c.id === selectedTopCategoryId)
    ? selectedTopCategoryId
    : (topCategories[0]?.id || '');
  const descendantCategories = useMemo(() => {
    if (!selectedTopId) return [] as Array<MenuCategory & { depth: number }>;
    const collect = (parentId: string, depth: number): Array<MenuCategory & { depth: number }> =>
      categories
        .filter((c) => c.parent_id === parentId && c.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .flatMap((child) => [{ ...child, depth }, ...collect(child.id, depth + 1)]);
    return collect(selectedTopId, 1);
  }, [categories, selectedTopId]);
  const selectedSubId = selectedSubCategoryId && descendantCategories.some((c) => c.id === selectedSubCategoryId)
    ? selectedSubCategoryId
    : '';

  const itemListFilterValue = useMemo(() => {
    if (showAllMenuItemTypes) return 'all:menu';
    if (!selectedTopId) return '';
    return selectedSubId ? `cat:${selectedSubId}` : `top:${selectedTopId}`;
  }, [showAllMenuItemTypes, selectedTopId, selectedSubId]);

  const handleItemListFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      if (!v) return;
      if (v === 'all:menu') {
        setShowAllMenuItemTypes(true);
        setSelectedSubCategoryId('');
        setSelectedTopCategoryId('');
        return;
      }
      if (v.startsWith('top:')) {
        setShowAllMenuItemTypes(false);
        setSelectedTopCategoryId(v.slice(4));
        setSelectedSubCategoryId('');
        return;
      }
      if (v.startsWith('cat:')) {
        setShowAllMenuItemTypes(false);
        const catId = v.slice(4);
        let topId = '';
        let cur: MenuCategory | undefined = categories.find((c) => c.id === catId);
        while (cur) {
          if (!cur.parent_id) {
            topId = cur.id;
            break;
          }
          const parentId = cur.parent_id;
          cur = categories.find((c) => c.id === parentId);
        }
        setSelectedTopCategoryId(topId);
        setSelectedSubCategoryId(catId);
      }
    },
    [categories],
  );

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || null;

  const groupedCategoryOptions = useMemo(() => {
    const collectOptions = (parentId: string, depth: number): Array<MenuCategory & { depth: number }> =>
      categories
        .filter((c) => c.parent_id === parentId && c.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .flatMap((child) => [{ ...child, depth }, ...collectOptions(child.id, depth + 1)]);

    return topCategories.map((top) => ({
      top,
      children: collectOptions(top.id, 1),
    }));
  }, [categories, topCategories]);

  const categoryDepthMap = useMemo(() => {
    const depthMap = new Map<string, number>();
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const resolveDepth = (categoryId: string): number => {
      if (depthMap.has(categoryId)) return depthMap.get(categoryId)!;
      const category = categoryById.get(categoryId);
      if (!category) return 1;
      if (!category.parent_id) {
        depthMap.set(categoryId, 1);
        return 1;
      }
      const depth = resolveDepth(category.parent_id) + 1;
      depthMap.set(categoryId, depth);
      return depth;
    };
    categories.forEach((c) => {
      resolveDepth(c.id);
    });
    return depthMap;
  }, [categories]);

  useEffect(() => {
    if (!selectedCategoryId && topCategories[0]) setSelectedCategoryId(topCategories[0].id);
  }, [selectedCategoryId, topCategories]);

  useEffect(() => {
    setExpandedCategoryKeys((prev) => {
      const ids = topCategories.map((c) => c.id);
      if (ids.length === 0) return prev;
      const merged = new Set([...prev, ...ids]);
      return Array.from(merged);
    });
  }, [topCategories]);

  useEffect(() => {
    if (selectedCategory) {
      setCategoryDraft({
        name_pt: selectedCategory.name_pt || '',
        name_en: selectedCategory.name_en || '',
        name_zh: selectedCategory.name_zh || '',
        item_code: selectedCategory.item_code || '',
        print_station_id: selectedCategory.print_station_id ?? '',
      });
      setCategoryError('');
    } else {
      setCategoryDraft(defaultCategoryDraft);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (categoryPanelMode === 'none') setCategoryError('');
  }, [categoryPanelMode]);

  useEffect(() => {
    if (!pendingImage) {
      setObjectPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(pendingImage);
    setObjectPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, [pendingImage]);

  const getCategoryLabel = (c: MenuCategory) => {
    if (lang === 'en') return c.name_en || c.name_pt;
    if (lang === 'zh') return c.name_zh || c.name_pt;
    return c.name_pt;
  };

  const getItemCategoryLine = (item: MenuItem): string => {
    const id = item.category_id;
    if (!id) return item.category?.trim() || t.uncategorized;
    const chain: MenuCategory[] = [];
    let cur: MenuCategory | undefined = categories.find((c) => c.id === id);
    while (cur) {
      chain.unshift(cur);
      const parentId = cur.parent_id;
      cur = parentId ? categories.find((c) => c.id === parentId) : undefined;
    }
    if (chain.length === 0) return item.category?.trim() || t.uncategorized;
    return chain
      .map((c) => {
        const label = getCategoryLabel(c);
        const code = c.item_code?.trim();
        return code ? `${label} [${code}]` : label;
      })
      .join(' · ');
  };

  const getEffectiveStationTicketLine = (item: MenuItem): string => {
    const eff = resolveEffectivePrintStationId(
      item.print_station_id,
      item.category_id ?? null,
      categories,
    );
    if (!eff) return t.effectiveStationNone;
    const st = printStations.find((p) => p.id === eff);
    const name = st
      ? lang === 'en'
        ? st.name_en || st.name_pt
        : lang === 'zh'
          ? st.name_zh || st.name_pt
          : st.name_pt
      : eff;
    return `${t.effectiveStationPrefix}: ${name}`;
  };

  const selectedItems = useMemo(() => {
    const collectDescendants = (rootId: string): string[] => {
      const acc: string[] = [];
      const walk = (id: string) => {
        categories
          .filter((c) => c.parent_id === id && c.active)
          .forEach((child) => {
            acc.push(child.id);
            walk(child.id);
          });
      };
      walk(rootId);
      return acc;
    };

    return items.filter((item) => {
      if (showAllMenuItemTypes) return true;
      if (!selectedTopId) return true;
      if (!item.category_id) return false;
      if (selectedSubId) return item.category_id === selectedSubId;
      if (item.category_id === selectedTopId) return true;
      const descendants = collectDescendants(selectedTopId);
      return descendants.includes(item.category_id);
    });
  }, [items, categories, selectedTopId, selectedSubId, showAllMenuItemTypes]);

  const resetImageUi = () => {
    setPendingImage(null);
    setStripImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeItemModal = () => {
    setItemModalOpen(false);
    setEditingItem(null);
    resetImageUi();
    setItemError('');
  };

  const openItemCreateModal = () => {
    const defaultCategoryId =
      showAllMenuItemTypes
        ? (topCategories[0]?.id || '')
        : (selectedSubId || selectedTopId || topCategories[0]?.id || '');
    setEditingItem(null);
    setItemForm({ ...defaultItemForm, category_id: defaultCategoryId });
    setItemError('');
    resetImageUi();
    setItemModalOpen(true);
  };

  const openItemEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name_pt: item.name_pt,
      name_en: item.name_en || '',
      name_zh: item.name_zh || '',
      description_pt: item.description_pt || '',
      description_en: item.description_en || '',
      price: String(item.price),
      category_id: item.category_id || '',
      item_code: item.item_code || '',
      print_station_id: item.print_station_id ?? '',
      emoji: item.emoji,
      available: item.available,
      note_preset_keys: item.note_preset_keys || [],
    });
    setItemError('');
    resetImageUi();
    setItemModalOpen(true);
  };

  const onPickImage = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const compressedFile = await compressMenuImageForUpload(file);
    const msg = validateMenuImageFile(compressedFile, {
      imageTooLarge: t.imageTooLarge,
      imageTypeInvalid: t.imageTypeInvalid,
    });
    if (msg) {
      setItemError(msg);
      return;
    }
    setItemError('');
    setStripImage(false);
    setPendingImage(compressedFile);
  };

  const isImageError = itemError === t.imageTooLarge || itemError === t.imageTypeInvalid;

  const saveItem = async () => {
    if (!itemForm.name_pt.trim()) return setItemError(t.ptNameRequired);
    if (!itemForm.price || Number.isNaN(Number(itemForm.price))) return setItemError(t.validPrice);
    if (!itemForm.category_id) return setItemError(t.category);
    const selectedCategoryRow = categories.find((c) => c.id === itemForm.category_id);
    if (!selectedCategoryRow) return setItemError(t.category);

    setItemSaving(true);
    setItemError('');
    const payload = {
      restaurant_id: restaurantId,
      name_pt: itemForm.name_pt.trim(),
      name_en: itemForm.name_en.trim() || null,
      name_zh: itemForm.name_zh.trim() || null,
      description_pt: itemForm.description_pt.trim() || null,
      description_en: itemForm.description_en.trim() || null,
      price: Number(itemForm.price),
      category_id: selectedCategoryRow.id,
      category: selectedCategoryRow.name_pt,
      category_en: selectedCategoryRow.name_en || selectedCategoryRow.name_pt,
      category_zh: selectedCategoryRow.name_zh || selectedCategoryRow.name_pt,
      emoji: itemForm.emoji,
      available: itemForm.available,
      note_preset_keys: itemForm.note_preset_keys,
      print_station_id: itemForm.print_station_id || null,
      item_code: normalizeMenuItemCode(itemForm.item_code),
    };

    try {
      let row: MenuItem;
      if (editingItem) {
        const { data, error } = await supabase.from('menu_items').update(payload).eq('id', editingItem.id).select().single();
        if (error) throw error;
        row = data;
      } else {
        const sortOrder = items.filter((i) => i.category_id === selectedCategoryRow.id).length;
        const { data, error } = await supabase.from('menu_items').insert({ ...payload, sort_order: sortOrder }).select().single();
        if (error) throw error;
        row = data;
      }

      const itemId = row.id;
      let imageUrl: string | null | undefined;
      if (stripImage && !pendingImage) {
        if (editingItem?.image_url) await removeMenuImageFromStorage(supabase, editingItem.image_url);
        imageUrl = null;
      } else if (pendingImage) {
        if (editingItem?.image_url) await removeMenuImageFromStorage(supabase, editingItem.image_url);
        const path = menuImageObjectPath(restaurantId, itemId, pendingImage.type);
        const { error: uploadError } = await supabase.storage.from('menu-images').upload(path, pendingImage, {
          upsert: true,
          contentType: pendingImage.type,
        });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('menu-images').getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }

      if (imageUrl !== undefined) {
        const { data, error } = await supabase.from('menu_items').update({ image_url: imageUrl }).eq('id', itemId).select().single();
        if (error) throw error;
        row = data;
      }

      if (editingItem) setItems((prev) => prev.map((i) => (i.id === editingItem.id ? row : i)));
      else setItems((prev) => [...prev, row]);
      closeItemModal();
    } catch {
      setItemError(t.saveFail);
    } finally {
      setItemSaving(false);
    }
  };

  const deleteItem = async (item: MenuItem) => {
    await removeMenuImageFromStorage(supabase, item.image_url);
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id);
    if (!error) setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const toggleItemAvailable = async (item: MenuItem) => {
    const { data, error } = await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id).select().single();
    if (!error && data) setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)));
  };

  const batchAvailable = async (available: boolean) => {
    const ids = selectedItems.map((i) => i.id);
    if (ids.length === 0) return;
    await supabase.from('menu_items').update({ available }).in('id', ids);
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, available } : i)));
  };

  const createCategory = async (parentId: string | null) => {
    if (!categoryDraft.name_pt.trim()) {
      setCategoryError('PT name is required');
      return;
    }
    if (parentId) {
      const parentDepth = categoryDepthMap.get(parentId) || 1;
      if (parentDepth >= MAX_CATEGORY_DEPTH) {
        const message = lang === 'zh'
          ? `最多支持 ${MAX_CATEGORY_DEPTH} 级菜单，当前节点已是第 ${parentDepth} 级。`
          : lang === 'en'
            ? `Maximum ${MAX_CATEGORY_DEPTH} levels are supported. The current node is already level ${parentDepth}.`
            : `O maximo suportado e ${MAX_CATEGORY_DEPTH} niveis. O nodo atual ja esta no nivel ${parentDepth}.`;
        setCategoryError(message);
        return;
      }
    }
    setCategorySaving(true);
    setCategoryError('');
    const siblings = categories.filter((c) => (c.parent_id || null) === parentId);
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({
        restaurant_id: restaurantId,
        parent_id: parentId,
        name_pt: categoryDraft.name_pt.trim(),
        name_en: categoryDraft.name_en.trim() || null,
        name_zh: categoryDraft.name_zh.trim() || null,
        item_code: normalizeMenuItemCode(categoryDraft.item_code),
        print_station_id: categoryDraft.print_station_id || null,
        sort_order: siblings.length,
        active: true,
      })
      .select()
      .single();
    setCategorySaving(false);
    if (error) return setCategoryError(error.message);
    setCategories((prev) => [...prev, data]);
    setSelectedCategoryId(data.id);
    if (parentId) {
      setExpandedCategoryKeys((prev) => {
        const merged = new Set([...prev, parentId]);
        return Array.from(merged);
      });
    }
    setCategoryDraft(defaultCategoryDraft);
    if (parentId) setCategoryPanelMode('none');
  };

  const updateSelectedCategory = async () => {
    if (!selectedCategory) return;
    if (!categoryDraft.name_pt.trim()) {
      setCategoryError('PT name is required');
      return;
    }
    setCategorySaving(true);
    setCategoryError('');
    const { data, error } = await supabase
      .from('menu_categories')
      .update({
        name_pt: categoryDraft.name_pt.trim(),
        name_en: categoryDraft.name_en.trim() || null,
        name_zh: categoryDraft.name_zh.trim() || null,
        item_code: normalizeMenuItemCode(categoryDraft.item_code),
        print_station_id: categoryDraft.print_station_id || null,
      })
      .eq('id', selectedCategory.id)
      .select()
      .single();
    setCategorySaving(false);
    if (error) return setCategoryError(error.message);
    setCategories((prev) => prev.map((c) => (c.id === selectedCategory.id ? data : c)));
    setCategoryPanelMode('none');
  };

  const deleteCategoryById = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    const hasChildren = categories.some((c) => c.parent_id === category.id && c.active);
    const linkedItemCount = items.filter((item) => item.category_id === category.id).length;

    if (hasChildren) {
      const message = lang === 'zh'
        ? '该父分类下仍有子分类，请先删除或迁移子分类后再删除父分类。'
        : lang === 'en'
          ? 'This parent category still has child categories. Remove or move child categories first.'
          : 'Esta categoria pai ainda possui subcategorias. Remova ou mova as subcategorias antes de excluir.';
      setConfirmDialog({
        open: true,
        intent: 'ack',
        title: t.remove,
        message,
      });
      return;
    }

    const confirmMessage = linkedItemCount > 0
      ? (lang === 'zh'
        ? `分类 "${category.name_pt}" 下有 ${linkedItemCount} 道菜品。确认后会一起删除该分类及其菜品，是否继续？`
        : lang === 'en'
          ? `Category "${category.name_pt}" has ${linkedItemCount} dishes. Confirming will delete both the category and its dishes. Continue?`
          : `A categoria "${category.name_pt}" tem ${linkedItemCount} pratos. Ao confirmar, a categoria e os pratos serao excluidos. Continuar?`)
      : `Delete category "${category.name_pt}"?`;

    setConfirmDialog({
      open: true,
      intent: 'delete_category',
      title: t.deleteConfirm,
      message: confirmMessage,
      categoryId: category.id,
    });
  };

  const confirmDeleteCategory = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;
    const linkedItemCount = items.filter((item) => item.category_id === category.id).length;
    if (linkedItemCount > 0) {
      const { error: dishDeleteError } = await supabase
        .from('menu_items')
        .delete()
        .eq('category_id', category.id);
      if (dishDeleteError) {
        setCategoryError(dishDeleteError.message);
        return;
      }
      setItems((prev) => prev.filter((item) => item.category_id !== category.id));
    }

    const { error } = await supabase.from('menu_categories').delete().eq('id', category.id);
    if (error) return setCategoryError(error.message);
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    setSelectedCategoryId((prev) => (prev === category.id ? '' : prev));
    setCategoryPanelMode('none');
  };

  const runConfirmAction = async () => {
    if (!confirmDialog.open) return;
    if (confirmDialog.intent === 'ack') {
      setConfirmDialog({ open: false });
      return;
    }
    setConfirmLoading(true);
    try {
      if (confirmDialog.intent === 'delete_item' && confirmDialog.itemId) {
        const item = items.find((i) => i.id === confirmDialog.itemId);
        if (item) await deleteItem(item);
      } else if (confirmDialog.intent === 'delete_category' && confirmDialog.categoryId) {
        await confirmDeleteCategory(confirmDialog.categoryId);
      }
      setConfirmDialog({ open: false });
    } finally {
      setConfirmLoading(false);
    }
  };

  const itemModalPreviewSrc = objectPreviewUrl || (!stripImage && editingItem?.image_url ? editingItem.image_url : null);

  const tabLabels = {
    items: lang === 'zh' ? '菜品管理' : lang === 'en' ? 'Dish manager' : 'Gestao de pratos',
    categories: lang === 'zh' ? '菜单类型管理' : lang === 'en' ? 'Category manager' : 'Gestao de categorias',
    all: lang === 'zh' ? '全部' : lang === 'en' ? 'All' : 'Todos',
    addRoot: lang === 'zh' ? '新增一级分类' : lang === 'en' ? 'Add top category' : 'Adicionar categoria raiz',
    addRootShort: lang === 'zh' ? '新增大类' : lang === 'en' ? 'Add root' : 'Nova raiz',
    addChild: lang === 'zh' ? '新增子分类' : lang === 'en' ? 'Add child category' : 'Adicionar subcategoria',
    categoryTreeHint: lang === 'zh' ? '在分类节点右侧直接操作：新增子类、编辑、删除。' : lang === 'en' ? 'Use the inline node actions: add child, edit, delete.' : 'Use as acoes inline no nodo: adicionar subcategoria, editar, excluir.',
    editCategoryTitle: lang === 'zh' ? '编辑分类' : lang === 'en' ? 'Edit category' : 'Editar categoria',
    addChildTitle: lang === 'zh' ? '新增子分类' : lang === 'en' ? 'Add child category' : 'Adicionar subcategoria',
    save: lang === 'zh' ? '保存' : lang === 'en' ? 'Save' : 'Salvar',
    close: lang === 'zh' ? '关闭' : lang === 'en' ? 'Close' : 'Fechar',
    linkedDishes: lang === 'zh' ? '道菜品已绑定。' : lang === 'en' ? 'dishes linked.' : 'pratos vinculados.',
    hasChildren: lang === 'zh' ? '包含子分类。' : lang === 'en' ? 'Has child categories.' : 'Possui subcategorias.',
    noChildren: lang === 'zh' ? '无子分类。' : lang === 'en' ? 'No child categories.' : 'Sem subcategorias.',
    pickNode: lang === 'zh' ? '请选择左侧分类节点。' : lang === 'en' ? 'Please select a category node from the left tree.' : 'Selecione uma categoria na arvore.',
    panelEmpty: lang === 'zh' ? '点击左侧分类节点的“编辑”或“新增子类”开始。' : lang === 'en' ? 'Click Edit or Add child on a category node to continue.' : 'Clique em Editar ou Adicionar subcategoria em um nodo para continuar.',
    depthHint: lang === 'zh' ? `最多支持 ${MAX_CATEGORY_DEPTH} 级菜单。` : lang === 'en' ? `Up to ${MAX_CATEGORY_DEPTH} menu levels are supported.` : `Suporta ate ${MAX_CATEGORY_DEPTH} niveis de menu.`,
    cancel: lang === 'zh' ? '取消' : lang === 'en' ? 'Cancel' : 'Cancelar',
    confirm: lang === 'zh' ? '确认' : lang === 'en' ? 'Confirm' : 'Confirmar',
  };

  const renderCategoryNodeTitle = (category: MenuCategory) => (
    <div className="group flex w-full items-center gap-2 min-h-7 pr-1">
      <span className={`truncate text-sm leading-5 ${selectedCategoryId === category.id ? 'text-brand-gold font-medium' : 'text-brand-text'}`}>
        {getCategoryLabel(category)}
      </span>
      <div className={`ml-auto flex h-6 items-center gap-1 rounded-md bg-brand-border/35 px-1 transition-opacity ${selectedCategoryId === category.id ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'}`}>
        {(() => {
          const depth = categoryDepthMap.get(category.id) || 1;
          const canAddChild = depth < MAX_CATEGORY_DEPTH;
          const maxDepthTitle = lang === 'zh'
            ? `最多${MAX_CATEGORY_DEPTH}级`
            : lang === 'en'
              ? `Max ${MAX_CATEGORY_DEPTH} levels`
              : `Max ${MAX_CATEGORY_DEPTH} niveis`;
          return (
        <button
          type="button"
          title={canAddChild ? tabLabels.addChild : maxDepthTitle}
          disabled={!canAddChild}
          onClick={(e) => {
            e.stopPropagation();
            if (!canAddChild) return;
            setSelectedCategoryId(category.id);
            setCategoryDraft(defaultCategoryDraft);
            setCategoryPanelMode('create-child');
          }}
          className="h-5 w-5 inline-flex items-center justify-center rounded-md border border-brand-border/70 bg-brand-card/80 text-brand-text leading-none hover:text-brand-gold hover:border-brand-gold/35 hover:bg-brand-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/45 focus-visible:bg-brand-gold/15 transition-colors disabled:opacity-35 disabled:hover:bg-brand-card/80 disabled:hover:text-brand-text disabled:cursor-not-allowed"
        >
          +
        </button>
          );
        })()}
        <button
          type="button"
          title={t.edit}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCategoryId(category.id);
            setCategoryPanelMode('edit');
          }}
          className="h-5 w-5 inline-flex items-center justify-center rounded-md border border-brand-border/70 bg-brand-card/80 text-brand-text leading-none hover:text-brand-gold hover:border-brand-gold/35 hover:bg-brand-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/45 focus-visible:bg-brand-gold/15 transition-colors"
        >
          ✎
        </button>
        <button
          type="button"
          title={t.remove}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCategoryId(category.id);
            void deleteCategoryById(category.id);
          }}
          className="h-5 w-5 inline-flex items-center justify-center rounded-md border border-red-400/35 bg-red-500/10 text-red-300 leading-none hover:text-red-100 hover:border-red-400/55 hover:bg-red-500/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/45 focus-visible:bg-red-500/22 transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );

  const buildTreeNodes = (parentId: string | null): DataNode[] =>
    categories
      .filter((c) => (c.parent_id || null) === parentId && c.active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((category) => {
        const children = buildTreeNodes(category.id);
        return {
          key: category.id,
          title: renderCategoryNodeTitle(category),
          children: children.length > 0 ? children : undefined,
          isLeaf: children.length === 0,
        } as DataNode;
      });

  const categoryTreeData: DataNode[] = buildTreeNodes(null);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {!embedded && (
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">
            {t.total} {items.length} {t.items}
          </p>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-lg text-sm border ${activeTab === 'categories' ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold' : 'border-brand-border text-brand-text-muted'}`}
        >
          {tabLabels.categories}
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 rounded-lg text-sm border ${activeTab === 'items' ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold' : 'border-brand-border text-brand-text-muted'}`}
        >
          {tabLabels.items}
        </button>
      </div>

      {activeTab === 'categories' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,360px),1fr] gap-4">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-4">
            <p className="text-[12px] text-brand-text-muted mb-2">{tabLabels.categoryTreeHint}</p>
            <p className="text-[12px] text-brand-text-muted mb-3">{tabLabels.depthHint}</p>
            {categoryTreeData.length === 0 ? (
              <p className="text-sm text-brand-text-muted">{tabLabels.pickNode}</p>
            ) : (
              <>
                <Tree
                  treeData={categoryTreeData}
                  selectedKeys={selectedCategoryId ? [selectedCategoryId] : []}
                  expandedKeys={expandedCategoryKeys}
                  onExpand={(keys) => setExpandedCategoryKeys(keys.map(String))}
                  onSelect={(keys) => {
                    const selected = keys[0];
                    if (!selected) return;
                    setSelectedCategoryId(String(selected));
                  }}
                  className="mesa-category-tree"
                  switcherIcon={<span className="text-brand-text-muted">▸</span>}
                />
                <button
                  type="button"
                  onClick={() => {
                    setCategoryDraft(defaultCategoryDraft);
                    setCategoryPanelMode('create-root');
                  }}
                  className="mt-2 w-full text-left text-sm text-brand-text-muted hover:text-brand-gold transition-colors"
                >
                  + {tabLabels.addRootShort}
                </button>
              </>
            )}
          </div>

          <div className="bg-brand-card border border-brand-border rounded-2xl p-4">
            {categoryPanelMode === 'none' || (categoryPanelMode !== 'create-root' && !selectedCategory) ? (
              <p className="text-sm text-brand-text-muted">{tabLabels.panelEmpty}</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-brand-text font-medium">
                    {categoryPanelMode === 'edit'
                      ? tabLabels.editCategoryTitle
                      : categoryPanelMode === 'create-root'
                        ? tabLabels.addRoot
                        : tabLabels.addChildTitle}
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => setCategoryPanelMode('none')}>
                    {tabLabels.close}
                  </Button>
                </div>
                {categoryPanelMode === 'create-child' && selectedCategory && (
                  <p className="text-[13px] text-brand-text-muted">
                    {lang === 'zh'
                      ? `父分类：${getCategoryLabel(selectedCategory)}`
                      : lang === 'en'
                        ? `Parent category: ${getCategoryLabel(selectedCategory)}`
                        : `Categoria pai: ${getCategoryLabel(selectedCategory)}`}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="PT"
                    value={categoryDraft.name_pt}
                    onChange={(e) => setCategoryDraft((prev) => ({ ...prev, name_pt: e.target.value }))}
                    placeholder={categoryPanelMode === 'edit' || categoryPanelMode === 'create-root' ? 'Pratos' : 'Peixe'}
                  />
                  <Input
                    label="EN"
                    value={categoryDraft.name_en}
                    onChange={(e) => setCategoryDraft((prev) => ({ ...prev, name_en: e.target.value }))}
                    placeholder={categoryPanelMode === 'edit' || categoryPanelMode === 'create-root' ? 'Mains' : 'Fish'}
                  />
                  <Input
                    label="ZH"
                    value={categoryDraft.name_zh}
                    onChange={(e) => setCategoryDraft((prev) => ({ ...prev, name_zh: e.target.value }))}
                    placeholder={categoryPanelMode === 'edit' || categoryPanelMode === 'create-root' ? '主菜' : '鱼类'}
                  />
                </div>
                <div>
                  <Input
                    label={t.categoryCode}
                    value={categoryDraft.item_code}
                    maxLength={10}
                    onChange={(e) =>
                      setCategoryDraft((prev) => ({ ...prev, item_code: e.target.value.slice(0, 10) }))
                    }
                    placeholder="A01"
                  />
                  <p className="text-[12px] text-brand-text-muted mt-1">{t.categoryCodeHint}</p>
                </div>
                <div>
                  <label className="text-sm text-brand-text-muted font-medium block mb-1.5">{t.categoryPrintStation}</label>
                  <select
                    value={categoryDraft.print_station_id}
                    onChange={(e) =>
                      setCategoryDraft((prev) => ({ ...prev, print_station_id: e.target.value }))
                    }
                    className="w-full max-w-md bg-brand-card border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  >
                    <option value="">{t.printStationCategoryNone}</option>
                    {printStations.map((ps) => (
                      <option key={ps.id} value={ps.id}>
                        {lang === 'en' ? ps.name_en || ps.name_pt : lang === 'zh' ? ps.name_zh || ps.name_pt : ps.name_pt}
                      </option>
                    ))}
                  </select>
                  <p className="text-[12px] text-brand-text-muted mt-1">{t.categoryPrintStationHint}</p>
                </div>
                {categoryError && (
                  <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">{categoryError}</p>
                )}
                <div className="flex gap-2">
                  {categoryPanelMode === 'edit' ? (
                    <Button onClick={updateSelectedCategory} loading={categorySaving}>{t.saveEdit}</Button>
                  ) : categoryPanelMode === 'create-root' ? (
                    <Button onClick={() => createCategory(null)} loading={categorySaving}>{tabLabels.save}</Button>
                  ) : (
                    <Button onClick={() => selectedCategory && createCategory(selectedCategory.id)} loading={categorySaving}>{tabLabels.save}</Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
              {selectedItems.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => batchAvailable(true)}
                    className="text-[13px] text-green-400 hover:underline"
                  >
                    {t.allOn}
                  </button>
                  <button
                    type="button"
                    onClick={() => batchAvailable(false)}
                    className="text-[13px] text-red-400 hover:underline"
                  >
                    {t.allOff}
                  </button>
                  <span className="hidden sm:block h-3 w-px bg-brand-border shrink-0" aria-hidden />
                </>
              )}
              <button
                type="button"
                onClick={openItemCreateModal}
                className="text-[13px] font-medium text-brand-gold hover:underline"
              >
                + {t.addItem}
              </button>
            </div>
            {topCategories.length > 0 ? (
              <div className="flex flex-row items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto sm:max-w-2xl">
                <label
                  htmlFor="menu-item-list-filter"
                  className="text-sm text-brand-text-muted font-medium shrink-0 sm:whitespace-nowrap"
                >
                  {t.filterDishList}
                </label>
                <select
                  id="menu-item-list-filter"
                  value={itemListFilterValue}
                  onChange={handleItemListFilterChange}
                  className="min-w-0 flex-1 sm:min-w-[12rem] sm:max-w-md bg-brand-card border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                >
                  <option value="all:menu">{t.filterAllTypes}</option>
                  {groupedCategoryOptions.map(({ top, children }) => (
                    <optgroup key={top.id} label={getCategoryLabel(top)}>
                      <option value={`top:${top.id}`}>
                        {t.allInTopCategory.replace('{name}', getCategoryLabel(top))}
                      </option>
                      {children.map((c) => (
                        <option key={c.id} value={`cat:${c.id}`}>
                          {`${'\u00A0\u00A0'.repeat(Math.max(0, c.depth - 1))}${c.depth > 1 ? '▸ ' : ''}${getCategoryLabel(c)}`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {selectedItems.length === 0 ? (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-10 sm:p-12 text-center">
              <p className="text-brand-text-muted text-sm">
                {showAllMenuItemTypes ? t.emptyEntireMenu : t.empty}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-brand-card border rounded-xl px-4 py-4 sm:px-5 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4 transition-all ${
                    item.available ? 'border-brand-border' : 'border-brand-border/70 bg-brand-bg/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-brand-border flex-shrink-0 flex items-center justify-center text-2xl">
                      {item.image_url ? (
                        <Image src={item.image_url} alt="" width={48} height={48} className="object-cover w-12 h-12" />
                      ) : (
                        item.emoji
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-brand-text font-medium truncate">
                          {item.item_code?.trim() ? `[${item.item_code.trim()}] ` : ''}
                          {item.name_pt}
                        </p>
                        {item.name_zh && <span className="text-brand-text-muted text-[13px] shrink-0">({item.name_zh})</span>}
                      </div>
                      {item.description_pt && <p className="text-brand-text-muted text-[13px] mt-0.5 line-clamp-2">{item.description_pt}</p>}
                      <p
                        className={`text-[12px] text-brand-text-muted ${item.description_pt ? 'mt-1' : 'mt-0.5'} line-clamp-2`}
                        title={getItemCategoryLine(item)}
                      >
                        <span className="text-brand-text-muted/75">{t.itemType}: </span>
                        {getItemCategoryLine(item)}
                      </p>
                      <p className="text-[12px] text-brand-text-muted/90 mt-0.5 line-clamp-1" title={getEffectiveStationTicketLine(item)}>
                        {getEffectiveStationTicketLine(item)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-between min-[480px]:justify-end sm:flex-nowrap sm:shrink-0 border-t border-brand-border pt-3 min-[480px]:border-0 min-[480px]:pt-0">
                    <span className="text-brand-gold font-medium tabular-nums">EUR{item.price.toFixed(2)}</span>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => toggleItemAvailable(item)}
                        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${item.available ? 'bg-green-500' : 'bg-brand-border'}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-brand-card border border-brand-border shadow-sm transition-transform ${
                            item.available ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      <div className="w-px h-4 bg-brand-border/80 mx-1" />
                      <div className="flex items-center gap-4">
                        <button type="button" onClick={() => openItemEditModal(item)} className="text-brand-text-muted hover:text-brand-gold transition-colors text-sm">{t.edit}</button>
                        <button
                          type="button"
                          onClick={() => setConfirmDialog({
                            open: true,
                            intent: 'delete_item',
                            title: t.deleteConfirm,
                            message: `${t.deleteConfirm} "${item.name_pt}"?`,
                            itemId: item.id,
                          })}
                          className="text-brand-text-muted hover:text-red-400 transition-colors text-sm"
                        >
                          {t.remove}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={itemModalOpen} onClose={closeItemModal} title={editingItem ? t.modalEdit : t.modalAdd} size="xl">
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-dashed border-brand-gold/35 bg-brand-bg/40 p-4 space-y-3">
            <div><span className="text-brand-gold mr-2" aria-hidden>📷</span><span className="text-sm text-brand-text font-medium">{t.dishPhoto}</span></div>
            <p className="text-[13px] text-brand-text-muted">{t.dishPhotoHint}</p>
            {isImageError && <p className="text-red-400 text-[13px] bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{itemError}</p>}
            <input ref={fileInputRef} type="file" accept={MENU_IMAGE_ACCEPT} className="hidden" onChange={(e) => onPickImage(e.target.files)} />
            <div className="flex flex-wrap items-center gap-3 min-h-[5.5rem]">
              {itemModalPreviewSrc ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-brand-border border border-brand-border shrink-0">
                  {itemModalPreviewSrc.startsWith('blob:') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={itemModalPreviewSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Image src={itemModalPreviewSrc} alt="" fill className="object-cover" sizes="96px" />
                  )}
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border border-brand-border bg-brand-card/80 flex items-center justify-center text-2xl text-brand-text-muted shrink-0">-</div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>{t.pickImage}</Button>
                {itemModalPreviewSrc && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStripImage(true);
                      setPendingImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    {t.removeImage}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-brand-text-muted font-medium block mb-2">{t.icon}</label>
            <div className="flex flex-wrap gap-2">
              {FOOD_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setItemForm((f) => ({ ...f, emoji }))}
                  className={`text-2xl p-2 rounded-lg transition-all ${itemForm.emoji === emoji ? 'bg-brand-gold/20 ring-2 ring-brand-gold' : 'hover:bg-brand-border'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t.ptNameReq} value={itemForm.name_pt} onChange={(e) => setItemForm((f) => ({ ...f, name_pt: e.target.value }))} placeholder="Bacalhau à Brás" />
            <Input label={t.enName} value={itemForm.name_en} onChange={(e) => setItemForm((f) => ({ ...f, name_en: e.target.value }))} placeholder="Codfish à Brás" />
          </div>
          <Input label={t.zhName} value={itemForm.name_zh} onChange={(e) => setItemForm((f) => ({ ...f, name_zh: e.target.value }))} placeholder="碎蛋鳕鱼" />
          <Input
            label={t.itemCode}
            value={itemForm.item_code}
            maxLength={10}
            onChange={(e) => setItemForm((f) => ({ ...f, item_code: e.target.value.slice(0, 10) }))}
            placeholder="001"
          />
          <p className="text-[12px] text-brand-text-muted -mt-2">{t.itemCodeHint}</p>
          <Input label={t.ptDesc} value={itemForm.description_pt} onChange={(e) => setItemForm((f) => ({ ...f, description_pt: e.target.value }))} placeholder="简短描述..." />
          <Input label={t.enDesc} value={itemForm.description_en} onChange={(e) => setItemForm((f) => ({ ...f, description_en: e.target.value }))} placeholder="Short description..." />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t.price}
              type="text"
              inputMode="decimal"
              value={itemForm.price}
              onChange={(e) => setItemForm((f) => ({ ...f, price: normalizeDecimalInput(e.target.value) }))}
              placeholder="12.50"
            />
            <div>
              <label className="text-sm text-brand-text-muted font-medium block mb-1.5">{t.category}</label>
              <select
                value={itemForm.category_id}
                onChange={(e) => setItemForm((f) => ({ ...f, category_id: e.target.value }))}
                className="w-full bg-brand-card border border-brand-border rounded-lg px-4 py-2.5 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              >
                <option value="">{t.category}</option>
                {groupedCategoryOptions.map(({ top, children }) => (
                  <optgroup key={top.id} label={getCategoryLabel(top)}>
                    <option value={top.id}>{getCategoryLabel(top)}</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${'\u00A0\u00A0'.repeat(Math.max(0, c.depth - 1))}${c.depth > 0 ? '▸ ' : ''}${getCategoryLabel(c)}`}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-brand-text-muted font-medium block mb-1.5">{t.itemPrintStation}</label>
            <select
              value={itemForm.print_station_id}
              onChange={(e) => setItemForm((f) => ({ ...f, print_station_id: e.target.value }))}
              className="w-full max-w-md bg-brand-card border border-brand-border rounded-lg px-4 py-2.5 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            >
              <option value="">{t.printStationItemInherit}</option>
              {printStations.map((ps) => (
                <option key={ps.id} value={ps.id}>
                  {lang === 'en' ? ps.name_en || ps.name_pt : lang === 'zh' ? ps.name_zh || ps.name_pt : ps.name_pt}
                </option>
              ))}
            </select>
            <p className="text-[12px] text-brand-text-muted mt-1">{t.itemPrintStationHint}</p>
          </div>

          <div className="rounded-xl border border-brand-border bg-brand-bg/40 p-4">
            <p className="text-sm font-medium text-brand-text">{noteUi.title}</p>
            <p className="text-[13px] text-brand-text-muted mt-1 mb-3">{noteUi.hint}</p>
            <div className="space-y-3">
              {(Object.keys(NOTE_PRESET_GROUP_LABELS) as NotePresetGroup[]).map((group) => {
                const options = NOTE_PRESETS.filter((preset) => preset.group === group);
                return (
                  <div key={group}>
                    <p className="text-[13px] text-brand-text-muted mb-2">{NOTE_PRESET_GROUP_LABELS[group][lang]}</p>
                    <div className="flex flex-wrap gap-2">
                      {options.map((preset) => {
                        const checked = itemForm.note_preset_keys.includes(preset.key);
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => setItemForm((prev) => ({
                              ...prev,
                              note_preset_keys: checked
                                ? prev.note_preset_keys.filter((k) => k !== preset.key)
                                : [...prev.note_preset_keys, preset.key],
                            }))}
                            className={`text-[13px] px-2.5 py-1 rounded-full border transition-colors ${
                              checked
                                ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold'
                                : 'bg-brand-card border-brand-border text-brand-text-muted hover:text-brand-text'
                            }`}
                          >
                            {preset.labels[lang]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {itemError && !isImageError && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">{itemError}</p>}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button onClick={saveItem} loading={itemSaving} className="flex-1">{editingItem ? t.saveEdit : t.addItem}</Button>
            <Button variant="outline" onClick={closeItemModal} className="w-full sm:w-auto">{t.cancel}</Button>
          </div>
        </div>
      </Modal>

      <style jsx global>{`
        .mesa-category-tree .rc-tree-treenode {
          margin: 2px 0;
        }
        .mesa-category-tree .rc-tree-node-content-wrapper {
          width: 100%;
          border-radius: 8px;
          min-height: 30px;
          padding: 1px 4px;
          display: flex;
          align-items: center;
          box-sizing: border-box;
        }
        .mesa-category-tree .rc-tree-node-selected,
        .mesa-category-tree .rc-tree-node-content-wrapper:hover {
          background: rgba(212, 175, 55, 0.08);
        }
        .mesa-category-tree .rc-tree-switcher {
          width: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>

      <Modal
        open={confirmDialog.open}
        onClose={() => {
          if (!confirmLoading) setConfirmDialog({ open: false });
        }}
        title={confirmDialog.open ? confirmDialog.title : ''}
        size="md"
      >
        {confirmDialog.open && (
          <div className="space-y-4">
            <p className="text-sm text-brand-text">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDialog({ open: false })} disabled={confirmLoading}>
                {tabLabels.cancel}
              </Button>
              {confirmDialog.intent === 'ack' ? (
                <Button onClick={() => setConfirmDialog({ open: false })}>{tabLabels.confirm}</Button>
              ) : (
                <Button variant="danger" onClick={runConfirmAction} loading={confirmLoading}>
                  {tabLabels.confirm}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
