'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { PrintStation, PrintStationTicketLayout } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

const SELECT_FIELD =
  'w-full bg-brand-card border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50';

interface PrintStationsManagerProps {
  restaurantId: string;
  initialStations: PrintStation[];
  /** When true (e.g. under `/dashboard/settings`), hide page title — same pattern as `MenuManager`. */
  embedded?: boolean;
}

type StationForm = {
  name_pt: string;
  name_en: string;
  name_zh: string;
  ticket_layout: PrintStationTicketLayout;
};

const defaultStationForm: StationForm = {
  name_pt: '',
  name_en: '',
  name_zh: '',
  ticket_layout: 'standard',
};

function layoutEmoji(layout: PrintStationTicketLayout): string {
  if (layout === 'kitchen') return '🍳';
  if (layout === 'beverage') return '🍷';
  return '🖨️';
}

export function PrintStationsManager({ restaurantId, initialStations, embedded }: PrintStationsManagerProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printStations;
  const tm = getMessages(lang).menuManager;
  const supabase = createClient();

  const [stations, setStations] = useState<PrintStation[]>(() =>
    [...initialStations].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
  );
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PrintStation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<PrintStation | null>(null);
  const [stationForm, setStationForm] = useState<StationForm>(defaultStationForm);
  const [stationSaving, setStationSaving] = useState(false);
  const [stationError, setStationError] = useState('');

  const layoutOptions = useMemo(
    () =>
      [
        { value: 'kitchen' as const, label: t.layoutKitchen },
        { value: 'beverage' as const, label: t.layoutBeverage },
        { value: 'standard' as const, label: t.layoutStandard },
      ],
    [t.layoutKitchen, t.layoutBeverage, t.layoutStandard],
  );

  const layoutLabel = (layout: PrintStationTicketLayout) =>
    layout === 'kitchen' ? t.layoutKitchen : layout === 'beverage' ? t.layoutBeverage : t.layoutStandard;

  const openStationCreateModal = () => {
    setEditingStation(null);
    setStationForm(defaultStationForm);
    setStationError('');
    setStationModalOpen(true);
  };

  const openStationEditModal = (row: PrintStation) => {
    setEditingStation(row);
    setStationForm({
      name_pt: row.name_pt,
      name_en: row.name_en ?? '',
      name_zh: row.name_zh ?? '',
      ticket_layout: row.ticket_layout,
    });
    setStationError('');
    setStationModalOpen(true);
  };

  const resetStationModal = () => {
    setStationModalOpen(false);
    setEditingStation(null);
    setStationForm(defaultStationForm);
    setStationError('');
  };

  const closeStationModal = () => {
    if (stationSaving) return;
    resetStationModal();
  };

  const saveStation = async () => {
    if (!stationForm.name_pt.trim()) {
      setStationError(tm.ptNameRequired);
      return;
    }
    setStationSaving(true);
    setStationError('');
    try {
      if (editingStation) {
        const { data, error: upErr } = await supabase
          .from('print_stations')
          .update({
            name_pt: stationForm.name_pt.trim(),
            name_en: stationForm.name_en.trim() || null,
            name_zh: stationForm.name_zh.trim() || null,
            ticket_layout: stationForm.ticket_layout,
          })
          .eq('id', editingStation.id)
          .select()
          .single();
        if (upErr) throw upErr;
        if (data) setStations((prev) => prev.map((s) => (s.id === editingStation.id ? (data as PrintStation) : s)));
      } else {
        const nextOrder = stations.length === 0 ? 0 : Math.max(...stations.map((s) => s.sort_order)) + 1;
        const { data, error: insErr } = await supabase
          .from('print_stations')
          .insert({
            restaurant_id: restaurantId,
            name_pt: stationForm.name_pt.trim(),
            name_en: stationForm.name_en.trim() || null,
            name_zh: stationForm.name_zh.trim() || null,
            ticket_layout: stationForm.ticket_layout,
            sort_order: nextOrder,
          })
          .select()
          .single();
        if (insErr) throw insErr;
        if (data) setStations((prev) => [...prev, data as PrintStation].sort((a, b) => a.sort_order - b.sort_order));
      }
      resetStationModal();
    } catch {
      setStationError(tm.saveFail);
    } finally {
      setStationSaving(false);
    }
  };

  const moveRow = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= stations.length) return;
    const a = stations[index];
    const b = stations[j];
    const oa = a.sort_order;
    const ob = b.sort_order;
    setError('');
    const { error: e1 } = await supabase.from('print_stations').update({ sort_order: ob }).eq('id', a.id);
    if (e1) {
      setError(e1.message || t.saveFail);
      return;
    }
    const { error: e2 } = await supabase.from('print_stations').update({ sort_order: oa }).eq('id', b.id);
    if (e2) {
      setError(e2.message || t.saveFail);
      return;
    }
    setStations((prev) => {
      const copy = prev.map((s) => ({ ...s }));
      const sa = copy[index];
      const sb = copy[j];
      copy[index] = { ...sa, sort_order: sb.sort_order };
      copy[j] = { ...sb, sort_order: sa.sort_order };
      return [...copy].sort((x, y) => x.sort_order - y.sort_order || x.created_at.localeCompare(y.created_at));
    });
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError('');
    const { error: delErr } = await supabase.from('print_stations').delete().eq('id', deleteTarget.id);
    setDeleteLoading(false);
    if (delErr) {
      setError(delErr.message || t.deleteFail);
      return;
    }
    setStations((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {!embedded && (
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.subtitle}</p>
        </div>
      )}

      <div className="text-[12px] text-brand-text-muted space-y-2 mb-6">
        {embedded ? <p className="text-sm text-brand-text-muted">{t.subtitle}</p> : null}
        <p>{t.hintShort}</p>
      </div>

      {error ? (
        <p className="mesa-alert-danger text-sm px-4 py-2 mb-4">{error}</p>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={openStationCreateModal}
          className="text-[13px] font-medium text-brand-gold hover:underline self-start sm:self-auto"
        >
          + {t.add}
        </button>
      </div>

      <div className="space-y-2">
        {stations.length === 0 ? (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-10 sm:p-12 text-center">
            <p className="text-brand-text-muted text-sm">{t.empty}</p>
          </div>
        ) : (
          stations.map((row, index) => (
            <div
              key={row.id}
              className="bg-brand-card border border-brand-border rounded-xl px-4 py-4 sm:px-5 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-brand-border flex-shrink-0 flex items-center justify-center text-2xl">
                  {layoutEmoji(row.ticket_layout)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-brand-text font-medium truncate">{row.name_pt}</p>
                    {row.name_zh ? (
                      <span className="text-brand-text-muted text-[13px] shrink-0">({row.name_zh})</span>
                    ) : null}
                  </div>
                  {row.name_en ? (
                    <p className="text-brand-text-muted text-[13px] mt-0.5 line-clamp-1">{row.name_en}</p>
                  ) : null}
                  <p className="text-[12px] text-brand-text-muted mt-0.5 line-clamp-1">
                    <span className="text-brand-text-muted/75">{t.colLayout}: </span>
                    {layoutLabel(row.ticket_layout)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-between min-[480px]:justify-end sm:flex-nowrap sm:shrink-0 border-t border-brand-border pt-3 min-[480px]:border-0 min-[480px]:pt-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={() => moveRow(index, -1)} disabled={index === 0}>
                    {t.moveUp}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => moveRow(index, 1)}
                    disabled={index === stations.length - 1}
                  >
                    {t.moveDown}
                  </Button>
                </div>
                <div className="w-px h-4 bg-brand-border/80 mx-1 hidden sm:block" aria-hidden />
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => openStationEditModal(row)}
                    className="text-brand-text-muted hover:text-brand-gold transition-colors text-sm"
                  >
                    {tm.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(row)}
                    className="text-brand-text-muted hover:text-status-danger transition-colors text-sm"
                  >
                    {tm.remove}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={stationModalOpen}
        onClose={closeStationModal}
        title={editingStation ? t.modalEdit : t.modalAdd}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={tm.ptNameReq}
              value={stationForm.name_pt}
              onChange={(e) => setStationForm((f) => ({ ...f, name_pt: e.target.value }))}
              placeholder="Cozinha"
            />
            <Input
              label={tm.enName}
              value={stationForm.name_en}
              onChange={(e) => setStationForm((f) => ({ ...f, name_en: e.target.value }))}
              placeholder="Kitchen"
            />
          </div>
          <Input
            label={tm.zhName}
            value={stationForm.name_zh}
            onChange={(e) => setStationForm((f) => ({ ...f, name_zh: e.target.value }))}
            placeholder="后厨"
          />
          <div className="max-w-md">
            <label className="text-sm text-brand-text-muted font-medium block mb-1.5">{t.colLayout}</label>
            <select
              value={stationForm.ticket_layout}
              onChange={(e) =>
                setStationForm((f) => ({ ...f, ticket_layout: e.target.value as PrintStationTicketLayout }))
              }
              className={SELECT_FIELD}
            >
              {layoutOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {stationError ? (
            <p className="mesa-alert-danger text-sm px-4 py-2">{stationError}</p>
          ) : null}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button onClick={saveStation} loading={stationSaving} className="flex-1">
              {editingStation ? tm.saveEdit : t.submitAdd}
            </Button>
            <Button variant="outline" onClick={closeStationModal} className="w-full sm:w-auto" disabled={stationSaving}>
              {tm.cancel}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => {
          if (!deleteLoading) setDeleteTarget(null);
        }}
        title={t.confirmDeleteTitle}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-text">{t.confirmDeleteBody}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={runDelete} loading={deleteLoading}>
              {t.confirm}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
