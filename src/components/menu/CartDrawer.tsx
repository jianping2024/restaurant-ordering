'use client';

import { useEffect } from 'react';
import type { CartItem, Language } from '@/types';
import { Button } from '@/components/ui/Button';
import {
  NOTE_PRESET_GROUP_LABELS,
  NOTE_PRESET_BY_KEY,
  NOTE_PRESETS,
  type NotePresetGroup,
} from '@/lib/note-presets';

const DRAWER_TEXT: Record<Language, { title: string; total: string; submit: string; notePlaceholder: string }> = {
  zh: {
    title: '购物车',
    total: '合计',
    submit: '提交订单',
    notePlaceholder: '备注（如：少盐、不要洋葱）',
  },
  en: {
    title: 'Cart',
    total: 'Total',
    submit: 'Place order',
    notePlaceholder: 'Notes (e.g. less salt, no onion)',
  },
  pt: {
    title: 'Carrinho',
    total: 'Total',
    submit: 'Enviar pedido',
    notePlaceholder: 'Nota (ex.: sem sal, sem cebola)',
  },
};

interface CartDrawerProps {
  open: boolean;
  cart: CartItem[];
  lang: Language;
  total: number;
  onClose: () => void;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdateNote: (id: string, note: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function CartDrawer({
  open, cart, lang, total, onClose, onUpdateQty, onUpdateNote, onSubmit, submitting
}: CartDrawerProps) {
  // 防止背景滚动
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const getName = (item: CartItem) =>
    (lang === 'zh' && item.name_zh) || (lang === 'en' && item.name_en) || item.name_pt;
  const text = DRAWER_TEXT[lang];
  const fallbackPresetKeys = NOTE_PRESETS.slice(0, 8).map((preset) => preset.key);

  const appendNote = (current: string | undefined, next: string) => {
    const value = (current || '').trim();
    if (!value) return next;
    if (value.includes(next)) return value;
    return `${value}; ${next}`;
  };

  return (
    <>
      {/* 遮罩 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={onClose}
        />
      )}

      {/* 抽屉 */}
      <div className={`
        fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile z-40
        bg-brand-card rounded-t-3xl border-t border-brand-border
        transition-transform duration-300 ease-out
        ${open ? 'translate-y-0' : 'translate-y-full'}
      `}>
        {/* 拖拽手柄 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-brand-border rounded-full" />
        </div>

        <div className="px-5 py-3 border-b border-brand-border flex items-center justify-between">
          <h2 className="font-heading text-xl text-brand-gold">{text.title}</h2>
          <button onClick={onClose} className="text-brand-text-muted hover:text-brand-text">✕</button>
        </div>

        {/* 购物车内容 */}
        <div className="overflow-y-auto max-h-[60vh] px-5 py-4 space-y-4">
          {cart.map(item => (
            <div key={item.menuItemId} className="border border-brand-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{item.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-brand-text text-sm font-medium truncate">{getName(item)}</p>
                    <p className="text-brand-gold text-[13px]">€{(item.price * item.qty).toFixed(2)}</p>
                  </div>
                </div>
                {/* 数量控制 */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onUpdateQty(item.menuItemId, item.qty - 1)}
                    className="w-7 h-7 rounded-full bg-brand-border text-brand-text flex items-center justify-center hover:bg-brand-gold/20"
                  >
                    −
                  </button>
                  <span className="text-brand-text text-sm w-4 text-center">{item.qty}</span>
                  <button
                    onClick={() => onUpdateQty(item.menuItemId, item.qty + 1)}
                    className="w-7 h-7 rounded-full bg-brand-border text-brand-text flex items-center justify-center hover:bg-brand-gold/20"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 备注输入 */}
              <div className="mt-3">
                <input
                  type="text"
                  placeholder={text.notePlaceholder}
                  value={item.note || ''}
                  onChange={e => onUpdateNote(item.menuItemId, e.target.value)}
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-[13px] text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-gold/50"
                />
                {/* 快捷备注（按分类） */}
                <div className="mt-2 space-y-2">
                  {(Object.keys(NOTE_PRESET_GROUP_LABELS) as NotePresetGroup[]).map((group) => {
                    const presetKeys = (item.notePresetKeys?.length ? item.notePresetKeys : fallbackPresetKeys)
                      .filter((key) => NOTE_PRESET_BY_KEY.get(key)?.group === group);
                    if (presetKeys.length === 0) return null;

                    return (
                      <div key={`${item.menuItemId}-${group}`}>
                        <p className="text-[13px] text-brand-text-muted mb-1">
                          {NOTE_PRESET_GROUP_LABELS[group][lang]}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {presetKeys.map((key) => {
                            const preset = NOTE_PRESET_BY_KEY.get(key);
                            if (!preset) return null;
                            const note = preset.labels[lang];
                            return (
                              <button
                                key={key}
                                onClick={() => onUpdateNote(item.menuItemId, appendNote(item.note, note))}
                                className="text-[13px] px-2 py-0.5 bg-brand-border rounded-full text-brand-text-muted hover:text-brand-gold hover:bg-brand-gold/10 transition-colors"
                              >
                                {note}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 底部结算 */}
        <div className="px-5 py-4 border-t border-brand-border">
          <div className="flex items-center justify-between mb-4">
            <span className="text-brand-text-muted text-sm">{text.total}</span>
            <span className="font-heading text-2xl text-brand-gold">€{total.toFixed(2)}</span>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={onSubmit}
            loading={submitting}
            disabled={cart.length === 0}
          >
            {text.submit}
          </Button>
        </div>
      </div>
    </>
  );
}
