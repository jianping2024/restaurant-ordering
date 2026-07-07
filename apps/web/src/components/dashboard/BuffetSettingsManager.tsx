'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { BuffetFridayWeekendPanel } from '@/components/dashboard/buffet/BuffetFridayWeekendPanel';
import { BuffetTimeSlotsPanel } from '@/components/dashboard/buffet/BuffetTimeSlotsPanel';
import { BuffetSettingsTabs } from '@/components/dashboard/buffet/BuffetSettingsTabs';
import { BuffetRulesToolbar } from '@/components/dashboard/buffet/BuffetRulesToolbar';
import { buffetFieldClass, buffetPanelBodyClass, buffetPanelClass } from '@/components/dashboard/buffet/buffet-field-styles';
import { BuffetPricePreview, type BuffetPricePreviewHandle } from '@/components/dashboard/buffet/BuffetPricePreview';
import { BuffetPriceMatrix } from '@/components/dashboard/buffet/BuffetPriceMatrix';
import { BuffetCalendarPanel } from '@/components/dashboard/buffet/BuffetCalendarPanel';
import {
  CALENDAR_KINDS,
  dbTimeToHm,
  findOverlappingRules,
  getRuleStatus,
  hmToDbTime,
  todayIsoLocal,
  type RuleStatusFilter,
} from '@/lib/buffet-pricing-admin';
import type { BuffetDashboardData } from '@/lib/dashboard-buffet-server';
import {
  applyBuffetDashboardData,
  createBuffetClient,
  createBuffetRuleClient,
  createBuffetSlotClient,
  deleteBuffetCalendarClient,
  deleteBuffetClient,
  deleteBuffetRuleClient,
  deleteBuffetSlotClient,
  toggleBuffetRuleActiveClient,
  updateBuffetClient,
  updateBuffetFridayPolicyClient,
  updateBuffetRuleClient,
  updateBuffetSlotClient,
  upsertBuffetCalendarClient,
} from '@/lib/dashboard-buffet-client';

interface Props {
  restaurantId: string;
  embedded?: boolean;
  initialData: BuffetDashboardData;
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

/** Fields preset from the price matrix should not be changed in the create modal. */
type RuleFieldLocks = {
  buffet?: boolean;
  slot?: boolean;
  calendarKind?: boolean;
};

type RuleModalState =
  | null
  | { mode: 'create'; locks?: RuleFieldLocks }
  | { mode: 'edit'; id: string };

function buildRuleDraft(
  buffets: Buffet[],
  slots: BuffetTimeSlot[],
  overrides?: Partial<RuleDraft>,
): RuleDraft | null {
  if (!buffets[0] || !slots[0]) return null;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const base: RuleDraft = {
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
  return { ...base, ...overrides };
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

export function BuffetSettingsManager({ restaurantId, embedded, initialData }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).buffetAdmin;
  const weekdayShort = t.weekdayShort;
  const today = todayIsoLocal();

  const [tab, setTab] = useState<'buffets' | 'slots' | 'rules' | 'calendar'>('buffets');
  const [buffets, setBuffets] = useState<Buffet[]>(initialData.buffets);
  const [slots, setSlots] = useState<BuffetTimeSlot[]>(initialData.slots);
  const [rules, setRules] = useState<BuffetPriceRule[]>(initialData.rules);
  const [calendarRows, setCalendarRows] = useState(initialData.calendarRows);

  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [promptSubmitting, setPromptSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const [ruleModal, setRuleModal] = useState<RuleModalState>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [ruleSaveSubmitting, setRuleSaveSubmitting] = useState(false);
  const [pendingConflictSave, setPendingConflictSave] = useState(false);

  const [rulesView, setRulesView] = useState<'matrix' | 'list'>('matrix');
  const [matrixBuffetId, setMatrixBuffetId] = useState('');
  const [filterBuffetId, setFilterBuffetId] = useState('');
  const [filterSlotId, setFilterSlotId] = useState('');
  const [filterDayKind, setFilterDayKind] = useState<BuffetCalendarKind | ''>('');
  const [filterStatus, setFilterStatus] = useState<RuleStatusFilter | 'all'>('all');

  const [fridayWeekendFrom, setFridayWeekendFrom] = useState<string | null>(
    initialData.buffet_friday_weekend_from,
  );
  const [fridayEnabled, setFridayEnabled] = useState(!!initialData.buffet_friday_weekend_from);
  const [fridayDraftFrom, setFridayDraftFrom] = useState(
    dbTimeToHm(initialData.buffet_friday_weekend_from) || '18:00',
  );
  const [fridaySaving, setFridaySaving] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<BuffetPricePreviewHandle>(null);

  const openPreviewAndScroll = useCallback(() => {
    setPreviewOpen(true);
    window.setTimeout(() => {
      previewRef.current?.scrollIntoView();
    }, 80);
  }, []);

  const dayKindLabel = useCallback(
    (k: BuffetCalendarKind | string) => {
      switch (k) {
        case 'weekday':
          return t.weekday;
        case 'weekend':
          return t.weekend;
        case 'holiday':
          return t.holiday;
        case 'special':
          return t.special;
        default:
          return k;
      }
    },
    [t],
  );

  const kindHelp = (k: BuffetCalendarKind) => {
    switch (k) {
      case 'weekday':
        return t.kindHelpWeekday;
      case 'weekend':
        return t.kindHelpWeekend;
      case 'holiday':
        return t.kindHelpHoliday;
      case 'special':
        return t.kindHelpSpecial;
    }
  };

  const applyDashboardData = useCallback(
    (data: Parameters<typeof applyBuffetDashboardData>[0]) => {
      applyBuffetDashboardData(data, {
        setBuffets,
        setSlots,
        setRules,
        setCalendarRows,
        setFridayWeekendFrom,
        setFridayEnabled,
        setFridayDraftFrom,
        dbTimeToHm,
      });
    },
    [],
  );

  useEffect(() => {
    if (!matrixBuffetId && buffets[0]) setMatrixBuffetId(buffets[0].id);
  }, [buffets, matrixBuffetId]);

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (filterBuffetId && rule.buffet_id !== filterBuffetId) return false;
      if (filterSlotId && rule.time_slot_id !== filterSlotId) return false;
      if (filterDayKind && rule.calendar_kind !== filterDayKind) return false;
      if (filterStatus !== 'all') {
        const st = getRuleStatus(rule, today);
        if (filterStatus === 'expired' && st !== 'expired') return false;
        if (filterStatus === 'active' && st !== 'active') return false;
        if (filterStatus === 'upcoming' && st !== 'upcoming') return false;
      }
      return true;
    });
  }, [rules, filterBuffetId, filterSlotId, filterDayKind, filterStatus, today]);

  const handlePromptSubmit = async (name: string) => {
    const kind = prompt?.kind;
    if (!kind) return;
    setPromptSubmitting(true);
    try {
      const result =
        kind === 'buffet'
          ? await createBuffetClient(name)
          : await createBuffetSlotClient(name, slots.length);
      if (!result.ok) showToast(t.saveError, 'error');
      else applyDashboardData(result.data);
      setPrompt(null);
    } finally {
      setPromptSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirm) return;
    setConfirmSubmitting(true);
    try {
      let result;
      if (confirm.kind === 'buffet') {
        result = await deleteBuffetClient(confirm.row.id);
      } else if (confirm.kind === 'slot') {
        result = await deleteBuffetSlotClient(confirm.id);
      } else if (confirm.kind === 'rule') {
        result = await deleteBuffetRuleClient(confirm.id);
      } else if (confirm.kind === 'calendar') {
        result = await deleteBuffetCalendarClient(confirm.onDate);
      }
      if (!result?.ok) showToast(t.saveError, 'error');
      else applyDashboardData(result.data);
      setConfirm(null);
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const toggleBuffet = async (row: Buffet) => {
    const result = await updateBuffetClient(row.id, { is_active: !row.is_active });
    if (!result.ok) showToast(t.saveError, 'error');
    else applyDashboardData(result.data);
  };

  const updateBuffetField = async (id: string, patch: Partial<Pick<Buffet, 'name' | 'is_active'>>) => {
    const result = await updateBuffetClient(id, patch);
    if (!result.ok) showToast(t.saveError, 'error');
    else applyDashboardData(result.data);
  };

  const updateSlotField = async (id: string, patch: Partial<BuffetTimeSlot>) => {
    const result = await updateBuffetSlotClient(id, patch);
    if (!result.ok) showToast(t.saveError, 'error');
    else applyDashboardData(result.data);
  };

  const openRuleCreateModal = (overrides?: Partial<RuleDraft>, locks?: RuleFieldLocks) => {
    const draft = buildRuleDraft(buffets, slots, overrides);
    if (!draft) {
      showToast(t.needSlotAndBuffet, 'error');
      return;
    }
    setRuleDraft(draft);
    setRuleModal({ mode: 'create', locks });
    setPendingConflictSave(false);
  };

  const openRuleEditModal = (rule: BuffetPriceRule) => {
    setRuleDraft(ruleToDraft(rule));
    setRuleModal({ mode: 'edit', id: rule.id });
    setPendingConflictSave(false);
  };

  const openRuleCopyModal = (rule: BuffetPriceRule) => {
    const draft = ruleToDraft(rule);
    setRuleDraft(draft);
    setRuleModal({ mode: 'create' });
    setPendingConflictSave(false);
  };

  const closeRuleModal = () => {
    setRuleModal(null);
    setRuleDraft(null);
    setPendingConflictSave(false);
  };

  const persistRule = async () => {
    if (!ruleDraft || !ruleModal) return;
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
      const result = await createBuffetRuleClient(payload);
      if (!result.ok) showToast(t.saveError, 'error');
      else {
        applyDashboardData(result.data);
        closeRuleModal();
      }
    } else {
      const result = await updateBuffetRuleClient(ruleModal.id, payload);
      if (!result.ok) showToast(t.saveError, 'error');
      else {
        applyDashboardData(result.data);
        closeRuleModal();
      }
    }
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

    const overlaps = findOverlappingRules(rules, {
      buffet_id: ruleDraft.buffet_id,
      time_slot_id: ruleDraft.time_slot_id,
      calendar_kind: ruleDraft.calendar_kind,
      valid_from: ruleDraft.valid_from,
      valid_to: ruleDraft.valid_to,
      excludeId: ruleModal.mode === 'edit' ? ruleModal.id : undefined,
    });

    if (overlaps.length > 0 && !pendingConflictSave) {
      setPendingConflictSave(true);
      return;
    }

    setRuleSaveSubmitting(true);
    try {
      await persistRule();
    } finally {
      setRuleSaveSubmitting(false);
    }
  };

  const toggleRuleActive = async (rule: BuffetPriceRule) => {
    const result = await toggleBuffetRuleActiveClient(rule.id, !rule.is_active);
    if (!result.ok) showToast(t.saveError, 'error');
    else applyDashboardData(result.data);
  };

  const upsertCalendarRows = async (rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>) => {
    const result = await upsertBuffetCalendarClient(rows);
    if (!result.ok) showToast(t.saveError, 'error');
    else applyDashboardData(result.data);
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

  const goAddRuleForKind = (calendarKind: BuffetCalendarKind) => {
    setTab('rules');
    setRulesView('matrix');
    openRuleCreateModal({ calendar_kind: calendarKind });
  };

  const saveFridayPolicy = async () => {
    let dbValue: string | null = null;
    if (fridayEnabled) {
      dbValue = hmToDbTime(fridayDraftFrom);
      if (!dbValue) {
        showToast(t.fridayWeekendTimeInvalid, 'error');
        return;
      }
    }
    setFridaySaving(true);
    try {
      const result = await updateBuffetFridayPolicyClient(dbValue);
      if (!result.ok) {
        showToast(t.saveError, 'error');
        return;
      }
      applyDashboardData(result.data);
      showToast(t.fridayWeekendSaved, 'success');
    } finally {
      setFridaySaving(false);
    }
  };

  const overlapNames =
    ruleDraft && ruleModal
      ? findOverlappingRules(rules, {
          buffet_id: ruleDraft.buffet_id,
          time_slot_id: ruleDraft.time_slot_id,
          calendar_kind: ruleDraft.calendar_kind,
          valid_from: ruleDraft.valid_from,
          valid_to: ruleDraft.valid_to,
          excludeId: ruleModal.mode === 'edit' ? ruleModal.id : undefined,
        })
          .map((r) => {
            const slot = slots.find((s) => s.id === r.time_slot_id)?.name ?? '';
            return `${dayKindLabel(r.calendar_kind)} ${r.valid_from?.slice(0, 10)}–${r.valid_to?.slice(0, 10)} (P${r.priority}${slot ? `, ${slot}` : ''})`;
          })
          .join('; ')
      : '';

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

  const showPricingTools = tab === 'rules' || tab === 'calendar';

  const fridayPolicyBlock = (embedded = false) =>
    showPricingTools && (
      <BuffetFridayWeekendPanel
        embedded={embedded}
        t={t}
        enabled={fridayEnabled}
        draftFrom={fridayDraftFrom}
        savedFrom={fridayWeekendFrom}
        saving={fridaySaving}
        onEnabledChange={setFridayEnabled}
        onDraftFromChange={setFridayDraftFrom}
        onSave={() => void saveFridayPolicy()}
      />
    );

  const rulesPreviewBlock = tab === 'rules' && buffets.some((b) => b.is_active) && (
    <BuffetPricePreview
      ref={previewRef}
      collapsible
      open={previewOpen}
      onOpenChange={setPreviewOpen}
      restaurantId={restaurantId}
      buffets={buffets}
      slots={slots}
      calendarRows={calendarRows}
      fridayWeekendFrom={fridayWeekendFrom}
      t={t}
      lang={lang}
      dayKindLabel={dayKindLabel}
    />
  );

  const tabs = [
    { id: 'buffets' as const, label: t.tabBuffets },
    { id: 'slots' as const, label: t.tabSlots },
    { id: 'rules' as const, label: t.tabRules },
    { id: 'calendar' as const, label: t.tabCalendar },
  ];

  return (
    <div className="space-y-6 w-full">
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

      <BuffetSettingsTabs
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id as (typeof tabs)[number]['id'])}
      />

      {tab === 'buffets' && (
        <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-brand-text-muted max-w-xl">{t.guideStepBuffet}</p>
            <button
              type="button"
              onClick={() => setPrompt({ kind: 'buffet' })}
              className="text-sm px-3 py-1.5 rounded-lg bg-brand-gold/20 text-brand-gold border border-brand-gold/35 shrink-0"
            >
              {t.addBuffet}
            </button>
          </div>
          {buffets.length === 0 ? (
            <p className="text-brand-text-muted text-sm py-2">{t.addBuffet}</p>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[minmax(0,16rem)_5rem_4.5rem] gap-x-3 px-3 text-[11px] font-medium text-brand-text-muted">
                <span>{t.name}</span>
                <span>{t.active}</span>
                <span className="sr-only">{t.delete}</span>
              </div>
              <ul className="space-y-1.5">
                {buffets.map((b) => (
                  <li
                    key={b.id}
                    className="grid grid-cols-1 sm:grid-cols-[minmax(0,16rem)_5rem_4.5rem] gap-2 sm:gap-3 sm:items-center border border-brand-border/60 rounded-lg px-3 py-2"
                  >
                    <input
                      key={`${b.id}-${b.name}`}
                      className={`w-full max-w-[16rem] ${buffetFieldClass}`}
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
                    <label className="flex items-center gap-1.5 text-[13px] text-brand-text-muted sm:justify-center">
                      <input type="checkbox" checked={b.is_active} onChange={() => void toggleBuffet(b)} />
                      {t.active}
                    </label>
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: 'buffet', row: b })}
                      className="text-[12px] mesa-text-danger border border-status-danger/35 px-2 py-0.5 rounded-md w-fit"
                    >
                      {t.delete}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === 'slots' && (
        <BuffetTimeSlotsPanel
          slots={slots}
          weekdayShort={weekdayShort}
          t={t}
          onAdd={() => setPrompt({ kind: 'slot' })}
          onUpdateName={(id, name) => void updateSlotField(id, { name })}
          onUpdateStart={(id, hm) => void updateSlotField(id, { start_time: `${hm}:00` })}
          onUpdateEnd={(id, hm) => void updateSlotField(id, { end_time: `${hm}:00` })}
          onUpdateSort={(id, n) => void updateSlotField(id, { sort_order: n })}
          onToggleWeekday={toggleWeekday}
          onDelete={(id) => setConfirm({ kind: 'slot', id })}
          onNameInvalid={() => showToast(t.slotNameRequired, 'error')}
        />
      )}

      {tab === 'rules' && (
        <div className="space-y-4">
          <div className={buffetPanelClass}>
            <BuffetRulesToolbar
              t={t}
              buffets={buffets}
              matrixBuffetId={matrixBuffetId}
              onMatrixBuffetIdChange={setMatrixBuffetId}
              rulesView={rulesView}
              onRulesViewChange={setRulesView}
              onOpenPreview={openPreviewAndScroll}
              onAddRule={() => openRuleCreateModal()}
              showPreview={buffets.some((b) => b.is_active)}
            />
            {fridayPolicyBlock(true)}

            <div className={buffetPanelBodyClass}>
              {rulesView === 'matrix' ? (
                <>
                  <BuffetPriceMatrix
                    buffetId={matrixBuffetId || buffets[0]?.id || ''}
                    buffets={buffets}
                    slots={slots}
                    rules={rules}
                    t={t}
                    dayKindLabel={dayKindLabel}
                    onSetPrice={({ buffetId, slotId, calendarKind, existingRule }) => {
                      if (existingRule) openRuleEditModal(existingRule);
                      else {
                        openRuleCreateModal(
                          { buffet_id: buffetId, time_slot_id: slotId, calendar_kind: calendarKind },
                          { buffet: true, slot: true, calendarKind: true },
                        );
                      }
                    }}
                  />
                  <p className="text-[11px] text-brand-text-muted mt-4 leading-relaxed">{t.matrixTodayNote}</p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-brand-border/50">
                    <select
                      className={`${buffetFieldClass} text-[13px] py-1.5 min-w-[9rem]`}
                      value={filterBuffetId}
                      onChange={(e) => setFilterBuffetId(e.target.value)}
                      aria-label={t.filterBuffet}
                    >
                      <option value="">
                        {t.filterBuffet}: {t.filterAll}
                      </option>
                      {buffets.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={`${buffetFieldClass} text-[13px] py-1.5 min-w-[9rem]`}
                      value={filterSlotId}
                      onChange={(e) => setFilterSlotId(e.target.value)}
                      aria-label={t.filterSlot}
                    >
                      <option value="">
                        {t.filterSlot}: {t.filterAll}
                      </option>
                      {slots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={`${buffetFieldClass} text-[13px] py-1.5 min-w-[9rem]`}
                      value={filterDayKind}
                      onChange={(e) => setFilterDayKind(e.target.value as BuffetCalendarKind | '')}
                      aria-label={t.filterDayKind}
                    >
                      <option value="">
                        {t.filterDayKind}: {t.filterAll}
                      </option>
                      {CALENDAR_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {dayKindLabel(k)}
                        </option>
                      ))}
                    </select>
                    <select
                      className={`${buffetFieldClass} text-[13px] py-1.5 min-w-[9rem]`}
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as RuleStatusFilter | 'all')}
                      aria-label={t.filterStatus}
                    >
                      <option value="all">{t.filterStatusAll}</option>
                      <option value="active">{t.filterStatusActive}</option>
                      <option value="upcoming">{t.filterStatusUpcoming}</option>
                      <option value="expired">{t.filterStatusExpired}</option>
                    </select>
                  </div>

                  {filteredRules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-brand-border/70 px-4 py-12 text-center">
                      <p className="text-sm text-brand-text-muted">{t.ruleListEmpty}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-1 px-1">
                      <table className="w-full min-w-[720px] text-left text-sm border-separate border-spacing-0">
                        <thead>
                          <tr>
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70">
                              {t.ruleBuffet}
                            </th>
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70">
                              {t.ruleSlot}
                            </th>
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70">
                              {t.calendarKind}
                            </th>
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70">
                              {t.ruleTablePeriod}
                            </th>
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70">
                              {t.ruleTablePrices}
                            </th>
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70">
                              {t.ruleTablePriority}
                            </th>
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70">
                              {t.active}
                            </th>
                            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted border-b border-brand-border/70">
                              {t.ruleTableActions}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                      {[...filteredRules]
                        .sort(
                          (a, b) =>
                            b.priority - a.priority || String(b.valid_from).localeCompare(String(a.valid_from)),
                        )
                        .map((rule) => {
                          const buffetName = buffets.find((b) => b.id === rule.buffet_id)?.name ?? '—';
                          const slotName = slots.find((s) => s.id === rule.time_slot_id)?.name ?? '—';
                          return (
                            <tr key={rule.id} className="hover:bg-brand-bg/40 transition-colors">
                              <td className="px-3 py-3 text-brand-text font-medium border-b border-brand-border/40">
                                {buffetName}
                              </td>
                              <td className="px-3 py-3 text-brand-text border-b border-brand-border/40">{slotName}</td>
                              <td className="px-3 py-3 text-brand-text-muted border-b border-brand-border/40">
                                {dayKindLabel(rule.calendar_kind)}
                              </td>
                              <td className="px-3 py-3 text-brand-text-muted whitespace-nowrap tabular-nums border-b border-brand-border/40">
                                {rule.valid_from?.slice(0, 10)} → {rule.valid_to?.slice(0, 10)}
                              </td>
                              <td className="px-3 py-3 text-brand-gold whitespace-nowrap tabular-nums border-b border-brand-border/40">
                                €{Number(rule.adult_price).toFixed(2)} / €{Number(rule.child_price).toFixed(2)}
                              </td>
                              <td className="px-3 py-3 text-brand-text-muted border-b border-brand-border/40">
                                {rule.priority}
                              </td>
                              <td className="px-3 py-3 border-b border-brand-border/40">
                                <input
                                  type="checkbox"
                                  checked={rule.is_active}
                                  onChange={() => void toggleRuleActive(rule)}
                                  className="rounded border-brand-border"
                                  aria-label={t.active}
                                />
                              </td>
                              <td className="px-3 py-3 text-right whitespace-nowrap border-b border-brand-border/40">
                                <button
                                  type="button"
                                  onClick={() => openRuleEditModal(rule)}
                                  className="text-[12px] text-brand-gold border border-brand-gold/40 px-2 py-0.5 rounded-md hover:bg-brand-gold/10 mr-1"
                                >
                                  {t.ruleEdit}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openRuleCopyModal(rule)}
                                  className="text-[12px] text-brand-text-muted border border-brand-border px-2 py-0.5 rounded-md hover:text-brand-text mr-1"
                                >
                                  {t.ruleCopy}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirm({ kind: 'rule', id: rule.id })}
                                  className="text-[12px] mesa-text-danger border border-status-danger/35 px-2 py-0.5 rounded-md"
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
            </>
          )}
            </div>

          <Modal
            open={!!ruleModal && !!ruleDraft}
            onClose={() => !ruleSaveSubmitting && closeRuleModal()}
            title={ruleModal?.mode === 'create' ? t.ruleModalAddTitle : t.ruleModalEditTitle}
            size="lg"
          >
            {ruleDraft && (() => {
              const fieldLocks: RuleFieldLocks | undefined =
                ruleModal?.mode === 'edit'
                  ? { buffet: true, slot: true, calendarKind: true }
                  : ruleModal?.mode === 'create'
                    ? ruleModal.locks
                    : undefined;
              const lockedBuffetName = buffets.find((b) => b.id === ruleDraft.buffet_id)?.name ?? '';
              const lockedSlot = slots.find((s) => s.id === ruleDraft.time_slot_id);
              const lockedFieldClass =
                'mt-0.5 w-full rounded-lg bg-brand-bg/60 border border-brand-border/80 px-2 py-2 text-brand-text';

              return (
              <>
                {pendingConflictSave && overlapNames && (
                  <div className="mb-4 mesa-alert-warning px-3 py-2 text-[13px] leading-relaxed">
                    <p className="font-medium">{t.ruleConflictTitle}</p>
                    <p className="mt-1">{t.ruleConflictBody.replace('{names}', overlapNames)}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <label className="text-brand-text-muted text-[12px]">
                    {t.ruleBuffet}
                    {fieldLocks?.buffet ? (
                      <p className={lockedFieldClass} aria-readonly>
                        {lockedBuffetName}
                      </p>
                    ) : (
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
                    )}
                  </label>
                  <label className="text-brand-text-muted text-[12px]">
                    {t.ruleSlot}
                    {fieldLocks?.slot ? (
                      <p className={`${lockedFieldClass} whitespace-nowrap`} aria-readonly>
                        {lockedSlot?.name ?? ''}
                        {lockedSlot ? (
                          <span className="text-brand-text-muted font-normal">
                            {' · '}
                            {lockedSlot.start_time?.slice(0, 5)}–{lockedSlot.end_time?.slice(0, 5)}
                          </span>
                        ) : null}
                      </p>
                    ) : (
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
                    )}
                  </label>
                  <div className="sm:col-span-2">
                    <label className="text-brand-text-muted text-[12px] block">
                      {t.calendarKind}
                      {fieldLocks?.calendarKind ? (
                        <p className={lockedFieldClass} aria-readonly>
                          {dayKindLabel(ruleDraft.calendar_kind)}
                        </p>
                      ) : (
                        <select
                          className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-2 text-brand-text"
                          value={ruleDraft.calendar_kind}
                          onChange={(e) => {
                            setPendingConflictSave(false);
                            setRuleDraft((d) =>
                              d ? { ...d, calendar_kind: e.target.value as BuffetCalendarKind } : d,
                            );
                          }}
                        >
                          {CALENDAR_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {dayKindLabel(k)}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                    <p className="mt-1 text-[11px] text-brand-text-muted">{kindHelp(ruleDraft.calendar_kind)}</p>
                  </div>
                  <label className="flex items-center gap-2 text-brand-text-muted text-[12px] sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={ruleDraft.is_active}
                      onChange={(e) =>
                        setRuleDraft((d) => (d ? { ...d, is_active: e.target.checked } : d))
                      }
                    />
                    {t.active}
                  </label>
                  <label className="text-brand-text-muted text-[12px] sm:col-span-2">
                    <span className="block">{t.validFrom} / {t.validTo}</span>
                    <span className="text-[11px] text-brand-text-muted/80">{t.ruleValidHint}</span>
                  </label>
                  <label className="text-brand-text-muted text-[12px]">
                    {t.validFrom}
                    <DashboardDatePicker
                      className="mt-0.5 w-full"
                      value={ruleDraft.valid_from}
                      onChange={(iso) => {
                        setPendingConflictSave(false);
                        setRuleDraft((d) => (d ? { ...d, valid_from: iso } : d));
                      }}
                      lang={lang}
                      placeholder={t.pickDate}
                    />
                  </label>
                  <label className="text-brand-text-muted text-[12px]">
                    {t.validTo}
                    <DashboardDatePicker
                      className="mt-0.5 w-full"
                      value={ruleDraft.valid_to}
                      onChange={(iso) => {
                        setPendingConflictSave(false);
                        setRuleDraft((d) => (d ? { ...d, valid_to: iso } : d));
                      }}
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
                  <div>
                    <label className="text-brand-text-muted text-[12px] block">
                      {t.priority}
                      <IntegerInput
                        className="mt-0.5 w-full rounded-lg bg-brand-bg border border-brand-border px-2 py-2 text-brand-text"
                        value={ruleDraft.priority}
                        min={0}
                        onChange={(priority) => {
                          setPendingConflictSave(false);
                          setRuleDraft((d) => (d ? { ...d, priority } : d));
                        }}
                      />
                    </label>
                    <p className="mt-1 text-[11px] text-brand-text-muted">{t.priorityHint}</p>
                  </div>
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
                    {pendingConflictSave ? t.ruleConflictSave : t.ruleSave}
                  </Button>
                </div>
              </>
              );
            })()}
          </Modal>
          </div>
          {rulesPreviewBlock}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="space-y-4">
          {fridayPolicyBlock()}
          <div className="bg-brand-card border border-brand-border rounded-xl p-4">
            <BuffetCalendarPanel
            calendarRows={calendarRows}
            rules={rules}
            buffets={buffets}
            t={t}
            lang={lang}
            dayKindLabel={dayKindLabel}
            onUpsert={upsertCalendarRows}
            onRemove={(onDate) => setConfirm({ kind: 'calendar', onDate })}
            onAddRuleForKind={goAddRuleForKind}
          />
          </div>
        </div>
      )}
    </div>
  );
}
