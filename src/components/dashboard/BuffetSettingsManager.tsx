'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Buffet, BuffetCalendarKind, BuffetPriceRule, BuffetTimeSlot } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { showToast } from '@/components/ui/Toast';
import { PromptModal } from '@/components/ui/PromptModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DashboardDatePicker } from '@/components/dashboard/DashboardDatePicker';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DecimalInput } from '@/components/ui/DecimalInput';
import { IntegerInput } from '@/components/ui/IntegerInput';

const DOW_LABELS_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const CALENDAR_KINDS: BuffetCalendarKind[] = ['weekday', 'weekend', 'holiday', 'special'];

interface Props {
  restaurantId: string;
  embedded?: boolean;
}

type PromptState = { kind: 'buffet' } | { kind: 'slot' };

type ConfirmState =
  | { kind: 'buffet'; row: Buffet }
  | { kind: 'slot'; id: string }
  | { kind: 'rule'; id: string }
  | { kind: 'calendar'; onDate: string };

type RuleDraft = {
  buffet_id: string;
  time_slot_id: string;
  calendar_kind: BuffetCalendarKind;
  valid_from: string;
  valid_to: string;
  adult_price: number;
  child_price: number;
  priority: number;
  is_active: boolean;
  note: string;
};

function buildDefaultRuleDraft(buffets: Buffet[], slots: BuffetTimeSlot[]): RuleDraft | null {
  if (!buffets[0] || !slots[0]) return null;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return {
    buffet_id: buffets[0].id,
    time_slot_id: slots[0].id,
    calendar_kind: 'weekday',
    valid_from: `${y}-${m}-${d}`,
    valid_to: `${y + 1}-${m}-${d}`,
    adult_price: 20,
    child_price: 10,
    priority: 0,
    is_active: true,
    note: '',
  };
}

function ruleToDraft(rule: BuffetPriceRule): RuleDraft {
  return {
    buffet_id: rule.buffet_id,
    time_slot_id: rule.time_slot_id,
    calendar_kind: rule.calendar_kind,
    valid_from: rule.valid_from?.slice(0, 10) ?? '',
    valid_to: rule.valid_to?.slice(0, 10) ?? '',
    adult_price: Number(rule.adult_price),
    child_price: Number(rule.child_price),
    priority: rule.priority,
    is_active: rule.is_active,
    note: rule.note ?? '',
  };
}

export function BuffetSettingsManager({ restaurantId, embedded }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).buffetAdmin;
  const supabase = createClient();

  const [tab, setTab] = useState<'buffets' | 'slots' | 'rules' | 'calendar'>('buffets');
  const [buffets, setBuffets] = useState<Buffet[]>([]);
  const [slots, setSlots] = useState<BuffetTimeSlot[]>([]);
  const [rules, setRules] = useState<BuffetPriceRule[]>([]);
  const [calendarRows, setCalendarRows] = useState<Array<{ on_date: string; kind: 'holiday' | 'special' }>>([]);
  const [loading, setLoading] = useState(true);

  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [promptSubmitting, setPromptSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const [ruleModal, setRuleModal] = useState<null | { mode: 'create' } | { mode: 'edit'; id: string }>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [ruleSaveSubmitting, setRuleSaveSubmitting] = useState(false);

  const reload = useCallback(async () => {
    const client = createClient();
    const [b, s, r, c] = await Promise.all([
      client.from('buffets').select('*').eq('restaurant_id', restaurantId).order('name'),
      client.from('buffet_time_slots').select('*').eq('restaurant_id', restaurantId).order('sort_order').order('name'),
      client.from('buffet_price_rules').select('*').eq('restaurant_id', restaurantId).order('priority', { ascending: false }),
      client.from('buffet_calendar_overrides').select('on_date, kind').eq('restaurant_id', restaurantId).order('on_date'),
    ]);
    if (b.error || s.error || r.error || c.error) {
      showToast(t.loadError, 'error');
      return;
    }
    setBuffets((b.data || []) as Buffet[]);
    setSlots((s.data || []) as BuffetTimeSlot[]);
    setRules((r.data || []) as BuffetPriceRule[]);
    setCalendarRows((c.data || []) as Array<{ on_date: string; kind: 'holiday' | 'special' }>);
  }, [restaurantId, t.loadError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const handlePromptSubmit = async (name: string) => {
    const kind = prompt?.kind;
    if (!kind) return;
    setPromptSubmitting(true);
    try {
      if (kind === 'buffet') {
        const { error } = await supabase.from('buffets').insert({
          restaurant_id: restaurantId,
          name,
          is_active: true,
        });
        if (error) showToast(t.saveError, 'error');
        else await reload();
      } else if (kind === 'slot') {
        const { error } = await supabase.from('buffet_time_slots').insert({
          restaurant_id: restaurantId,
          name,
          start_time: '11:00:00',
          end_time: '15:00:00',
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          sort_order: slots.length,
        });
        if (error) showToast(t.saveError, 'error');
        else await reload();
      }
      setPrompt(null);
    } finally {
      setPromptSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirm) return;
    setConfirmSubmitting(true);
    try {
      if (confirm.kind === 'buffet') {
        const { error } = await supabase.from('buffets').delete().eq('id', confirm.row.id);
        if (error) showToast(t.saveError, 'error');
        else await reload();
      } else if (confirm.kind === 'slot') {
        const { error } = await supabase.from('buffet_time_slots').delete().eq('id', confirm.id);
        if (error) showToast(t.saveError, 'error');
        else await reload();
      } else if (confirm.kind === 'rule') {
        const { error } = await supabase.from('buffet_price_rules').delete().eq('id', confirm.id);
        if (error) showToast(t.saveError, 'error');
        else await reload();
      } else if (confirm.kind === 'calendar') {
        const { error } = await supabase
          .from('buffet_calendar_overrides')
          .delete()
          .eq('restaurant_id', restaurantId)
          .eq('on_date', confirm.onDate);
        if (error) showToast(t.saveError, 'error');
        else await reload();
      }
      setConfirm(null);
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const toggleBuffet = async (row: Buffet) => {
    const { error } = await supabase.from('buffets').update({ is_active: !row.is_active }).eq('id', row.id);
    if (error) showToast(t.saveError, 'error');
    else await reload();
  };

  const updateBuffetField = async (id: string, patch: Partial<Pick<Buffet, 'name' | 'is_active'>>) => {
    const { error } = await supabase.from('buffets').update(patch).eq('id', id);
    if (error) showToast(t.saveError, 'error');
    else await reload();
  };

  const updateSlotField = async (id: string, patch: Partial<BuffetTimeSlot>) => {
    const { error } = await supabase.from('buffet_time_slots').update(patch).eq('id', id);
    if (error) showToast(t.saveError, 'error');
    else await reload();
  };

  const openRuleCreateModal = () => {
    const draft = buildDefaultRuleDraft(buffets, slots);
    if (!draft) {
      showToast(t.needSlotAndBuffet, 'error');
      return;
    }
    setRuleDraft(draft);
    setRuleModal({ mode: 'create' });
  };

  const openRuleEditModal = (rule: BuffetPriceRule) => {
    setRuleDraft(ruleToDraft(rule));
    setRuleModal({ mode: 'edit', id: rule.id });
  };

  const closeRuleModal = () => {
    setRuleModal(null);
    setRuleDraft(null);
  };

  const saveRuleModal = async () => {
    if (!ruleDraft || !ruleModal) return;
    if (!ruleDraft.valid_from || !ruleDraft.valid_to) {
      showToast(t.ruleDateRequired, 'error');
      return;
    }
    if (ruleDraft.valid_to < ruleDraft.valid_from) {
      showToast(t.ruleInvalidDateRange, 'error');
      return;
    }
    setRuleSaveSubmitting(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        buffet_id: ruleDraft.buffet_id,
        time_slot_id: ruleDraft.time_slot_id,
        calendar_kind: ruleDraft.calendar_kind,
        valid_from: ruleDraft.valid_from,
        valid_to: ruleDraft.valid_to,
        adult_price: ruleDraft.adult_price,
        child_price: ruleDraft.child_price,
        priority: ruleDraft.priority,
        is_active: ruleDraft.is_active,
        note: ruleDraft.note.trim() || null,
      };
      if (ruleModal.mode === 'create') {
        const { error } = await supabase.from('buffet_price_rules').insert(payload);
        if (error) showToast(t.saveError, 'error');
        else {
          await reload();
          closeRuleModal();
        }
      } else {
        const { error } = await supabase.from('buffet_price_rules').update(payload).eq('id', ruleModal.id);
        if (error) showToast(t.saveError, 'error');
        else {
          await reload();
          closeRuleModal();
        }
      }
    } finally {
      setRuleSaveSubmitting(false);
    }
  };

  const toggleRuleActive = async (rule: BuffetPriceRule) => {
    const { error } = await supabase
      .from('buffet_price_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    if (error) showToast(t.saveError, 'error');
    else await reload();
  };

  const [calDate, setCalDate] = useState('');
  const [calKind, setCalKind] = useState<'holiday' | 'special'>('holiday');

  const upsertCalendar = async () => {
    if (!calDate) return;
    const { error } = await supabase.from('buffet_calendar_overrides').upsert({
      restaurant_id: restaurantId,
      on_date: calDate,
      kind: calKind,
    });
    if (error) showToast(t.saveError, 'error');
    else await reload();
  };

  const toggleWeekday = (slot: BuffetTimeSlot, dow: number) => {
    const set = new Set(slot.weekdays || []);
    if (set.has(dow)) {
      if (set.size <= 1) return;
      set.delete(dow);
    } else {
      set.add(dow);
    }
    void updateSlotField(slot.id, { weekdays: Array.from(set).sort((a, b) => a - b) });
  };

  const confirmMessage =
    confirm?.kind === 'buffet'
      ? t.confirmDeleteBuffet.replace('{name}', confirm.row.name)
      : confirm?.kind === 'slot'
        ? t.confirmDeleteSlot
        : confirm?.kind === 'rule'
          ? t.confirmDeleteRule
          : confirm?.kind === 'calendar'
            ? t.confirmRemoveCalendar
            : '';

  if (loading) {
    return <p className="text-brand-text-muted text-sm">…</p>;
  }

  const tabs = [
    { id: 'buffets' as const, label: t.tabBuffets },
    { id: 'slots' as const, label: t.tabSlots },
    { id: 'rules' as const, label: t.tabRules },
    { id: 'calendar' as const, label: t.tabCalendar },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <PromptModal
        open={prompt?.kind === 'buffet'}
        onClose={() => !promptSubmitting && setPrompt(null)}
        title={t.addBuffet}
        label={t.name}
        defaultValue=""
        submitLabel={t.dialogConfirm}
        cancelLabel={t.dialogCancel}
        onSubmit={handlePromptSubmit}
        submitting={promptSubmitting && prompt?.kind === 'buffet'}
      />
      <PromptModal
        open={prompt?.kind === 'slot'}
        onClose={() => !promptSubmitting && setPrompt(null)}
        title={t.addSlot}
        label={t.slotName}
        defaultValue={t.slotNameDefault}
        submitLabel={t.dialogConfirm}
        cancelLabel={t.dialogCancel}
        onSubmit={handlePromptSubmit}
        submitting={promptSubmitting && prompt?.kind === 'slot'}
      />
      <ConfirmModal
        open={!!confirm}
        onClose={() => !confirmSubmitting && setConfirm(null)}
        title={t.confirmDeleteTitle}
        message={confirmMessage}
        confirmLabel={t.delete}
        cancelLabel={t.dialogCancel}
        onConfirm={handleConfirmAction}
        variant="danger"
        confirming={confirmSubmitting}
      />

      {!embedded && (
        <div>
          <h1 className="font-heading text-2xl text-brand-gold">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.subtitle}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              tab === x.id
                ? 'bg-brand-gold text-brand-bg font-medium'
                : 'bg-brand-card border border-brand-border text-brand-text-muted hover:text-brand-text'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'buffets' && (
        <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-3">
          <button
            type="button"
            onClick={() => setPrompt({ kind: 'buffet' })}
            className="text-sm px-3 py-1.5 rounded-lg bg-brand-gold/20 text-brand-gold border border-brand-gold/35"
          >
            {t.addBuffet}
          </button>
          {buffets.length === 0 ? (
            <p className="text-brand-text-muted text-sm">{t.addBuffet}</p>
          ) : (
            <ul className="space-y-2">
              {buffets.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-2 justify-between border border-brand-border/60 rounded-lg px-3 py-2">
                  <input
                    key={`${b.id}-${b.name}`}
                    className="rounded-lg bg-brand-bg border border-brand-border px-2 py-1 text-sm text-brand-text font-medium flex-1 min-w-[120px] max-w-md"
                    defaultValue={b.name}
                    title={t.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v) {
                        showToast(t.buffetNameRequired, 'error');
                        e.target.value = b.name;
                        return;
                      }
                      if (v !== b.name) void updateBuffetField(b.id, { name: v });
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[13px] text-brand-text-muted">
                      <input type="checkbox" checked={b.is_active} onChange={() => void toggleBuffet(b)} />
                      {t.active}
                    </label>
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: 'buffet', row: b })}
                      className="text-[12px] text-rose-700 border border-rose-500/35 px-2 py-0.5 rounded-md"
                    >
                      {t.delete}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'slots' && (
        <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-4">
          <button
            type="button"
            onClick={() => setPrompt({ kind: 'slot' })}
            className="text-sm px-3 py-1.5 rounded-lg bg-brand-gold/20 text-brand-gold border border-brand-gold/35"
          >
            {t.addSlot}
          </button>
          {slots.map((slot) => (
            <div key={slot.id} className="border border-brand-border/60 rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  className="rounded-lg bg-brand-bg border border-brand-border px-2 py-1 text-sm text-brand-text flex-1 min-w-[120px]"
                  defaultValue={slot.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== slot.name) void updateSlotField(slot.id, { name: v });
                  }}
                />
                <input
                  type="time"
                  className="rounded-lg bg-brand-bg border border-brand-border px-2 py-1 text-sm text-brand-text"
                  defaultValue={slot.start_time?.slice(0, 5) || '11:00'}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v) void updateSlotField(slot.id, { start_time: `${v}:00` });
                  }}
                />
                <span className="text-brand-text-muted">—</span>
                <input
                  type="time"
                  className="rounded-lg bg-brand-bg border border-brand-border px-2 py-1 text-sm text-brand-text"
                  defaultValue={slot.end_time?.slice(0, 5) || '15:00'}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v) void updateSlotField(slot.id, { end_time: `${v}:00` });
                  }}
                />
                <IntegerInput
                  className="w-20 rounded-lg bg-brand-bg border border-brand-border px-2 py-1 text-sm text-brand-text"
                  value={slot.sort_order ?? 0}
                  min={0}
                  onChange={(n) => void updateSlotField(slot.id, { sort_order: n })}
                  title={t.sortOrder}
                />
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: 'slot', id: slot.id })}
                  className="text-[12px] text-rose-700 border border-rose-500/35 px-2 py-0.5 rounded-md"
                >
                  {t.delete}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {DOW_LABELS_ZH.map((label, dow) => (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleWeekday(slot, dow)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      (slot.weekdays || []).includes(dow)
                        ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold'
                        : 'border-brand-border text-brand-text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'rules' && (
        <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-brand-text-muted max-w-xl">{t.ruleListHint}</p>
            <Button type="button" size="sm" onClick={openRuleCreateModal}>
              {t.addRule}
            </Button>
          </div>

          {rules.length === 0 ? (
            <p className="text-sm text-brand-text-muted text-center py-8 border border-dashed border-brand-border rounded-xl">
              {t.ruleListEmpty}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-brand-border/60">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-border/20 text-[12px] text-brand-text-muted">
                    <th className="px-3 py-2 font-medium">{t.ruleBuffet}</th>
                    <th className="px-3 py-2 font-medium">{t.ruleSlot}</th>
                    <th className="px-3 py-2 font-medium">{t.calendarKind}</th>
                    <th className="px-3 py-2 font-medium">{t.ruleTablePeriod}</th>
                    <th className="px-3 py-2 font-medium">{t.ruleTablePrices}</th>
                    <th className="px-3 py-2 font-medium">{t.ruleTablePriority}</th>
                    <th className="px-3 py-2 font-medium">{t.active}</th>
                    <th className="px-3 py-2 font-medium text-right">{t.ruleTableActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rules]
                    .sort((a, b) => b.priority - a.priority || String(b.valid_from).localeCompare(String(a.valid_from)))
                    .map((rule) => {
                      const buffetName = buffets.find((b) => b.id === rule.buffet_id)?.name ?? '—';
                      const slotName = slots.find((s) => s.id === rule.time_slot_id)?.name ?? '—';
                      const calLabel =
                        rule.calendar_kind === 'weekday'
                          ? t.weekday
                          : rule.calendar_kind === 'weekend'
                            ? t.weekend
                            : rule.calendar_kind === 'holiday'
                              ? t.holiday
                              : t.special;
                      return (
                        <tr key={rule.id} className="border-b border-brand-border/50 last:border-0 hover:bg-brand-border/10">
                          <td className="px-3 py-2.5 text-brand-text font-medium">{buffetName}</td>
                          <td className="px-3 py-2.5 text-brand-text">{slotName}</td>
                          <td className="px-3 py-2.5 text-brand-text-muted">{calLabel}</td>
                          <td className="px-3 py-2.5 text-brand-text-muted whitespace-nowrap">
                            {rule.valid_from?.slice(0, 10)} → {rule.valid_to?.slice(0, 10)}
                          </td>
                          <td className="px-3 py-2.5 text-brand-gold whitespace-nowrap">
                            €{Number(rule.adult_price).toFixed(2)} / €{Number(rule.child_price).toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-brand-text-muted">{rule.priority}</td>
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={rule.is_active}
                              onChange={() => void toggleRuleActive(rule)}
                              className="rounded border-brand-border"
                              aria-label={t.active}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openRuleEditModal(rule)}
                              className="text-[12px] text-brand-gold border border-brand-gold/40 px-2 py-0.5 rounded-md hover:bg-brand-gold/10 mr-2"
                            >
                              {t.ruleEdit}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirm({ kind: 'rule', id: rule.id })}
                              className="text-[12px] text-rose-700 border border-rose-500/35 px-2 py-0.5 rounded-md"
                            >
                              {t.delete}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          <Modal
            open={!!ruleModal && !!ruleDraft}
            onClose={() => !ruleSaveSubmitting && closeRuleModal()}
            title={ruleModal?.mode === 'create' ? t.ruleModalAddTitle : t.ruleModalEditTitle}
            size="lg"
          >
            {ruleDraft && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <label className="text-brand-text-muted text-[12px]">
                    {t.ruleBuffet}
                    <select
                      className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-2 text-brand-text"
                      value={ruleDraft.buffet_id}
                      onChange={(e) =>
                        setRuleDraft((d) => (d ? { ...d, buffet_id: e.target.value } : d))
                      }
                    >
                      {buffets.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-brand-text-muted text-[12px]">
                    {t.ruleSlot}
                    <select
                      className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-2 text-brand-text"
                      value={ruleDraft.time_slot_id}
                      onChange={(e) =>
                        setRuleDraft((d) => (d ? { ...d, time_slot_id: e.target.value } : d))
                      }
                    >
                      {slots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-brand-text-muted text-[12px]">
                    {t.calendarKind}
                    <select
                      className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-2 text-brand-text"
                      value={ruleDraft.calendar_kind}
                      onChange={(e) =>
                        setRuleDraft((d) =>
                          d ? { ...d, calendar_kind: e.target.value as BuffetCalendarKind } : d,
                        )
                      }
                    >
                      {CALENDAR_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k === 'weekday'
                            ? t.weekday
                            : k === 'weekend'
                              ? t.weekend
                              : k === 'holiday'
                                ? t.holiday
                                : t.special}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-brand-text-muted text-[12px] mt-6 sm:mt-8">
                    <input
                      type="checkbox"
                      checked={ruleDraft.is_active}
                      onChange={(e) =>
                        setRuleDraft((d) => (d ? { ...d, is_active: e.target.checked } : d))
                      }
                    />
                    {t.active}
                  </label>
                  <label className="text-brand-text-muted text-[12px] sm:col-span-1">
                    {t.validFrom}
                    <DashboardDatePicker
                      className="mt-0.5 w-full"
                      value={ruleDraft.valid_from}
                      onChange={(iso) => setRuleDraft((d) => (d ? { ...d, valid_from: iso } : d))}
                      lang={lang}
                      placeholder={t.pickDate}
                    />
                  </label>
                  <label className="text-brand-text-muted text-[12px]">
                    {t.validTo}
                    <DashboardDatePicker
                      className="mt-0.5 w-full"
                      value={ruleDraft.valid_to}
                      onChange={(iso) => setRuleDraft((d) => (d ? { ...d, valid_to: iso } : d))}
                      lang={lang}
                      placeholder={t.pickDate}
                    />
                  </label>
                  <label className="text-brand-text-muted text-[12px]">
                    {t.adultPrice}
                    <DecimalInput
                      className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-2 text-brand-text"
                      value={ruleDraft.adult_price}
                      onChange={(adult_price) => setRuleDraft((d) => (d ? { ...d, adult_price } : d))}
                    />
                  </label>
                  <label className="text-brand-text-muted text-[12px]">
                    {t.childPrice}
                    <DecimalInput
                      className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-2 text-brand-text"
                      value={ruleDraft.child_price}
                      onChange={(child_price) => setRuleDraft((d) => (d ? { ...d, child_price } : d))}
                    />
                  </label>
                  <label className="text-brand-text-muted text-[12px]">
                    {t.priority}
                    <IntegerInput
                      className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-2 text-brand-text"
                      value={ruleDraft.priority}
                      min={0}
                      onChange={(priority) => setRuleDraft((d) => (d ? { ...d, priority } : d))}
                    />
                  </label>
                  <label className="text-brand-text-muted text-[12px] sm:col-span-2">
                    {t.note}
                    <input
                      className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-2 text-brand-text"
                      value={ruleDraft.note}
                      onChange={(e) =>
                        setRuleDraft((d) => (d ? { ...d, note: e.target.value } : d))
                      }
                    />
                  </label>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-brand-border pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={closeRuleModal}
                    disabled={ruleSaveSubmitting}
                  >
                    {t.dialogCancel}
                  </Button>
                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    loading={ruleSaveSubmitting}
                    onClick={() => void saveRuleModal()}
                  >
                    {t.ruleSave}
                  </Button>
                </div>
              </>
            )}
          </Modal>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-brand-text-muted text-[12px] block min-w-[200px]">
              {t.calendarDate}
              <DashboardDatePicker
                className="mt-0.5 w-full max-w-[240px]"
                value={calDate}
                onChange={setCalDate}
                lang={lang}
                placeholder={t.pickDate}
              />
            </label>
            <label className="text-brand-text-muted text-[12px]">
              {t.calendarTag}
              <select
                className="mt-0.5 block rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-brand-text"
                value={calKind}
                onChange={(e) => setCalKind(e.target.value as 'holiday' | 'special')}
              >
                <option value="holiday">{t.holiday}</option>
                <option value="special">{t.special}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void upsertCalendar()}
              className="text-sm px-3 py-1.5 rounded-lg bg-brand-gold text-brand-bg font-medium"
            >
              {t.addCalendar}
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {calendarRows.map((row) => (
              <li key={row.on_date} className="flex justify-between items-center border border-brand-border/50 rounded-lg px-3 py-1.5">
                <span className="text-brand-text">
                  {row.on_date} — {row.kind === 'holiday' ? t.holiday : t.special}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: 'calendar', onDate: row.on_date })}
                  className="text-[12px] text-rose-700"
                >
                  {t.removeCalendar}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
