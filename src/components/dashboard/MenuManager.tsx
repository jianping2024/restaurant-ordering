'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import type { MenuItem, Category } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { CATEGORY_LABELS, getMessages } from '@/lib/i18n/messages';
import { MENU_CATEGORIES } from '@/lib/menu';
import {
  MENU_IMAGE_ACCEPT,
  menuImageObjectPath,
  removeMenuImageFromStorage,
  validateMenuImageFile,
} from '@/lib/menu-image';

const FOOD_EMOJIS = ['🍽️','🍞','🥗','🥣','🐟','🥚','🍗','🐙','🥩','🦆','🫒','🍷','🍺','💧','☕','🥧','🍮','🫕','🥘','🍲'];

interface MenuManagerProps {
  restaurantId: string;
  initialItems: MenuItem[];
}

const defaultForm = {
  name_pt: '',
  name_en: '',
  name_zh: '',
  description_pt: '',
  description_en: '',
  price: '',
  category: 'Pratos' as Category,
  emoji: '🍽️',
  available: true,
};

export function MenuManager({ restaurantId, initialItems }: MenuManagerProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).menuManager;
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [activeCategory, setActiveCategory] = useState<Category>('Pratos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [stripImage, setStripImage] = useState(false);
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!pendingImage) {
      setObjectPreviewUrl(u => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(pendingImage);
    setObjectPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, [pendingImage]);

  const resetImageUi = () => {
    setPendingImage(null);
    setStripImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeModal = () => {
    resetImageUi();
    setModalOpen(false);
  };

  const modalPreviewSrc =
    objectPreviewUrl || (!stripImage && editing?.image_url ? editing.image_url : null);

  const categoryItems = items.filter(i => i.category === activeCategory);

  // 打开新增弹窗
  const openAdd = () => {
    setEditing(null);
    resetImageUi();
    setForm({ ...defaultForm, category: activeCategory });
    setError('');
    setModalOpen(true);
  };

  // 打开编辑弹窗
  const openEdit = (item: MenuItem) => {
    resetImageUi();
    setEditing(item);
    setForm({
      name_pt: item.name_pt,
      name_en: item.name_en || '',
      name_zh: item.name_zh || '',
      description_pt: item.description_pt || '',
      description_en: item.description_en || '',
      price: item.price.toString(),
      category: item.category,
      emoji: item.emoji,
      available: item.available,
    });
    setError('');
    setModalOpen(true);
  };

  const onPickImage = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const msg = validateMenuImageFile(file, { imageTooLarge: t.imageTooLarge, imageTypeInvalid: t.imageTypeInvalid });
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    setStripImage(false);
    setPendingImage(file);
  };

  // 保存（新增/编辑）
  const handleSave = async () => {
    if (!form.name_pt.trim()) { setError(t.ptNameRequired); return; }
    if (!form.price || isNaN(Number(form.price))) { setError(t.validPrice); return; }

    setSaving(true);
    setError('');

    const payload = {
      restaurant_id: restaurantId,
      name_pt: form.name_pt.trim(),
      name_en: form.name_en.trim() || null,
      name_zh: form.name_zh.trim() || null,
      description_pt: form.description_pt.trim() || null,
      description_en: form.description_en.trim() || null,
      price: Number(form.price),
      category: form.category,
      emoji: form.emoji,
      available: form.available,
    };

    try {
      let row: MenuItem;

      if (editing) {
        const { data, error } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', editing.id)
          .select()
          .single();

        if (error) throw error;
        row = data;
      } else {
        const sortOrder = items.filter(i => i.category === form.category).length;
        const { data, error } = await supabase
          .from('menu_items')
          .insert({ ...payload, sort_order: sortOrder })
          .select()
          .single();

        if (error) throw error;
        row = data;
      }

      const itemId = row.id;
      let imageUrl: string | null | undefined;

      if (stripImage && !pendingImage) {
        if (editing?.image_url) {
          await removeMenuImageFromStorage(supabase, editing.image_url);
        }
        imageUrl = null;
      } else if (pendingImage) {
        if (editing?.image_url) {
          await removeMenuImageFromStorage(supabase, editing.image_url);
        }
        const path = menuImageObjectPath(restaurantId, itemId, pendingImage.type);
        const { error: upErr } = await supabase.storage.from('menu-images').upload(path, pendingImage, {
          upsert: true,
          contentType: pendingImage.type,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('menu-images').getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }

      if (imageUrl !== undefined) {
        const { data: withImage, error: imgErr } = await supabase
          .from('menu_items')
          .update({ image_url: imageUrl })
          .eq('id', itemId)
          .select()
          .single();
        if (imgErr) throw imgErr;
        row = withImage;
      }

      if (editing) {
        setItems(prev => prev.map(i => i.id === editing.id ? row : i));
      } else {
        setItems(prev => [...prev, row]);
      }
      closeModal();
    } catch {
      setError(t.saveFail);
    } finally {
      setSaving(false);
    }
  };

  // 删除
  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`${t.deleteConfirm} "${item.name_pt}"?`)) return;
    await removeMenuImageFromStorage(supabase, item.image_url);
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== item.id));
    }
  };

  // 上下架切换
  const toggleAvailable = async (item: MenuItem) => {
    const { data, error } = await supabase
      .from('menu_items')
      .update({ available: !item.available })
      .eq('id', item.id)
      .select()
      .single();
    if (!error && data) {
      setItems(prev => prev.map(i => i.id === item.id ? data : i));
    }
  };

  // 批量上架/下架
  const batchAvailable = async (available: boolean) => {
    const ids = categoryItems.map(i => i.id);
    await supabase.from('menu_items').update({ available }).in('id', ids);
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, available } : i));
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.total} {items.length} {t.items}</p>
        </div>
        <Button onClick={openAdd} className="w-full sm:w-auto shrink-0">+ {t.addItem}</Button>
      </div>

      {/* 分类 Tab */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {MENU_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-5 py-2.5 rounded-xl text-sm transition-all ${
              activeCategory === cat
                ? 'bg-brand-gold text-brand-bg font-semibold'
                : 'bg-brand-card border border-brand-border text-brand-text-muted hover:text-brand-text'
            }`}
          >
            {CATEGORY_LABELS[lang][cat]} <span className="text-[13px] opacity-70">({items.filter(i=>i.category===cat).length})</span>
          </button>
        ))}
      </div>

      {/* 批量操作 */}
      {categoryItems.length > 0 && (
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => batchAvailable(true)}
            className="text-[13px] text-green-400 hover:underline"
          >{t.allOn}</button>
          <button
            onClick={() => batchAvailable(false)}
            className="text-[13px] text-red-400 hover:underline"
          >{t.allOff}</button>
        </div>
      )}

      {/* 菜品列表 */}
      {categoryItems.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted mb-4">{t.empty}</p>
          <Button onClick={openAdd} variant="outline">{t.addFirst}</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {categoryItems.map(item => (
            <div
              key={item.id}
              className={`bg-brand-card border rounded-xl px-4 py-4 sm:px-5 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4 transition-all
                ${item.available ? 'border-brand-border' : 'border-brand-border/70 bg-brand-bg/40'}`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-brand-border flex-shrink-0 flex items-center justify-center text-2xl">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt=""
                      width={48}
                      height={48}
                      className="object-cover w-12 h-12"
                    />
                  ) : (
                    item.emoji
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-brand-text font-medium truncate">{item.name_pt}</p>
                    {item.name_zh && (
                      <span className="text-brand-text-muted text-[13px] shrink-0">({item.name_zh})</span>
                    )}
                  </div>
                  {item.description_pt && (
                    <p className="text-brand-text-muted text-[13px] mt-0.5 line-clamp-2">{item.description_pt}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-between min-[480px]:justify-end sm:flex-nowrap sm:shrink-0 border-t border-brand-border pt-3 min-[480px]:border-0 min-[480px]:pt-0">
                <span className="text-brand-gold font-medium tabular-nums">€{item.price.toFixed(2)}</span>

                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {/* 上下架开关 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleAvailable(item)}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                        item.available ? 'bg-green-500' : 'bg-brand-border'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        item.available ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="w-px h-4 bg-brand-border/80 mx-1" />

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="text-brand-text-muted hover:text-brand-gold transition-colors text-sm"
                    >{t.edit}</button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="text-brand-text-muted hover:text-red-400 transition-colors text-sm"
                    >{t.remove}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑弹窗 */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t.modalEdit : t.modalAdd}
        size="xl"
      >
        <div className="space-y-4">
          {/* 菜品图片：置顶 + 虚线框，避免被误认为「没有上传区」（与 API 是否返回 image_url 无关） */}
          <div className="rounded-xl border-2 border-dashed border-brand-gold/35 bg-brand-bg/40 p-4 space-y-3">
            <div>
              <span className="text-brand-gold mr-2" aria-hidden>📷</span>
              <span className="text-sm text-brand-text font-medium">{t.dishPhoto}</span>
            </div>
            <p className="text-[13px] text-brand-text-muted">{t.dishPhotoHint}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={MENU_IMAGE_ACCEPT}
              className="hidden"
              onChange={e => onPickImage(e.target.files)}
            />
            <div className="flex flex-wrap items-center gap-3 min-h-[5.5rem]">
              {modalPreviewSrc ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-brand-border border border-brand-border shrink-0">
                  {modalPreviewSrc.startsWith('blob:') ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob: URLs are not valid for next/image
                    <img src={modalPreviewSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Image src={modalPreviewSrc} alt="" fill className="object-cover" sizes="96px" />
                  )}
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border border-brand-border bg-brand-card/80 flex items-center justify-center text-2xl text-brand-text-muted shrink-0">
                  —
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  {t.pickImage}
                </Button>
                {modalPreviewSrc && (
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

          {/* Emoji 选择器 */}
          <div>
            <label className="text-sm text-brand-text-muted font-medium block mb-2">{t.icon}</label>
            <div className="flex flex-wrap gap-2">
              {FOOD_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, emoji }))}
                  className={`text-2xl p-2 rounded-lg transition-all ${
                    form.emoji === emoji
                      ? 'bg-brand-gold/20 ring-2 ring-brand-gold'
                      : 'hover:bg-brand-border'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t.ptNameReq}
              value={form.name_pt}
              onChange={e => setForm(f => ({ ...f, name_pt: e.target.value }))}
              placeholder="Bacalhau à Brás"
            />
            <Input
              label={t.enName}
              value={form.name_en}
              onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
              placeholder="Codfish à Brás"
            />
          </div>
          <Input
            label={t.zhName}
            value={form.name_zh}
            onChange={e => setForm(f => ({ ...f, name_zh: e.target.value }))}
            placeholder="碎蛋鳕鱼"
          />
          <Input
            label={t.ptDesc}
            value={form.description_pt}
            onChange={e => setForm(f => ({ ...f, description_pt: e.target.value }))}
            placeholder="简短描述..."
          />
          <Input
            label={t.enDesc}
            value={form.description_en}
            onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
            placeholder="Short description..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t.price}
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="12.50"
            />
            <div>
              <label className="text-sm text-brand-text-muted font-medium block mb-1.5">{t.category}</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                className="w-full bg-brand-card border border-brand-border rounded-lg px-4 py-2.5 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              >
                {MENU_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[lang][c]}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editing ? t.saveEdit : t.addItem}
            </Button>
            <Button variant="outline" onClick={closeModal} className="w-full sm:w-auto">
              {t.cancel}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
