'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { MenuCategory, MenuItem, PrintStation, PrintStationTicketLayout } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { countPrintStationBindings, getPrintStationDisplayName } from '@/lib/print-station-admin';
import {
  createPrintStationClient,
  deletePrintStationClient,
  swapPrintStationOrderClient,
  updatePrintStationClient,
} from '@/lib/dashboard-menu-client';

const SELECT_FIELD =
  'w-full bg-brand-card border border-brand-border rounded-lg px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50';

interface PrintStationsManagerProps {
  restaurantId: string;
  initialStations: PrintStation[];
  initialCategories?: Pick<MenuCategory, 'id' | 'print_station_id'>[];
  initialItems?: Pick<MenuItem, 'id' | 'print_station_id'>[];
  onStationsChange?: (stations: PrintStation[]) => void;
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

export function PrintStationsManager({
  initialStations,
  initialCategories = [],
  initialItems = [],
  onStationsChange,
}: PrintStationsManagerProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printStations;
  const tm = getMessages(lang).menuManager;

  const [stations, setStations] = useState<PrintStation[]>(() =>
    [...initialStations].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
  );

  useEffect(() => {
    onStationsChange?.(stations);
  }, [stations, onStationsChange]);
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

  const bindingsForStation = (stationId: string) =>
    countPrintStationBindings(stationId, initialCategories, initialItems);

  const bindingsLabel = (stationId: string) => {
    const { categories, dishes } = bindingsForStation(stationId);
    if (categories === 0 && dishes === 0) return t.bindingsEmpty;
    return t.bindingsSummary.replace('{categories}', String(categories)).replace('{dishes}', String(dishes));
  };

  const deleteTargetBindings = deleteTarget ? bindingsForStation(deleteTarget.id) : null;

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
      const input = {
        name_pt: stationForm.name_pt.trim(),
        name_en: stationForm.name_en.trim() || null,
        name_zh: stationForm.name_zh.trim() || null,
        ticket_layout: stationForm.ticket_layout,
      };
      if (editingStation) {
        const result = await updatePrintStationClient(editingStation.id, input);
        if (!result.ok) throw new Error(result.error);
        setStations((prev) =>
          prev.map((s) => (s.id === editingStation.id ? result.data.station : s)),
        );
      } else {
        const result = await createPrintStationClient(input);
        if (!result.ok) throw new Error(result.error);
        setStations((prev) =>
          [...prev, result.data.station].sort(
            (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
          ),
        );
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
    setError('');
    const result = await swapPrintStationOrderClient(a.id, b.id);
    if (!result.ok) {
      setError(t.saveFail);
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
    const result = await deletePrintStationClient(deleteTarget.id);
    setDeleteLoading(false);
    if (!result.ok) {
      setError(t.deleteFail);
      return;
    }
    setStations((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {error ? (
        <p className="mesa-alert-danger text-sm px-4 py-2 mb-4">{error}</p>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" onClick={openStationCreateModal} className="w-full sm:w-auto shrink-0">
          + {t.add}
        </Button>
      </div>

      {stations.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-10 sm:p-12 text-center">
          <p className="text-brand-text-muted text-sm mb-4">{t.empty}</p>
          <Button type="button" onClick={openStationCreateModal}>
            {t.emptyCta}
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-brand-border bg-brand-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-brand-text-muted">
                  <th className="px-4 py-3 font-medium" scope="col">
                    {t.colName}
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    {t.colLayout}
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    {t.colBindings}
                  </th>
                  <th className="px-4 py-3 font-medium text-right w-[14rem]" scope="col">
                    {t.colActions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stations.map((row, index) => (
                  <tr key={row.id} className="border-b border-brand-border/80 last:border-0">
                    <td className="px-4 py-3 min-w-[10rem]">
                      <p className="text-brand-text font-medium flex items-center gap-2">
                        <span className="text-lg leading-none" aria-hidden>
                          {layoutEmoji(row.ticket_layout)}
                        </span>
                        {getPrintStationDisplayName(row, lang)}
                      </p>
                      {row.name_pt !== getPrintStationDisplayName(row, lang) ? (
                        <p className="text-[12px] text-brand-text-muted mt-0.5">PT: {row.name_pt}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-brand-text-muted whitespace-nowrap">
                      {layoutLabel(row.ticket_layout)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-brand-text-muted">{bindingsLabel(row.id)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={t.moveUp}
                          title={t.moveUp}
                          disabled={index === 0}
                          onClick={() => moveRow(index, -1)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-brand-border/70 text-brand-text-muted hover:text-brand-gold disabled:opacity-35"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={t.moveDown}
                          title={t.moveDown}
                          disabled={index === stations.length - 1}
                          onClick={() => moveRow(index, 1)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-brand-border/70 text-brand-text-muted hover:text-brand-gold disabled:opacity-35"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => openStationEditModal(row)}
                          className="text-brand-text-muted hover:text-brand-gold transition-colors text-sm px-2 py-1"
                        >
                          {tm.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          className="mesa-text-danger hover:opacity-90 transition-colors text-sm px-2 py-1"
                        >
                          {tm.remove}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="hidden md:block text-[12px] text-brand-text-muted mt-2">{t.sortOrderHint}</p>

          <div className="md:hidden space-y-2">
            {stations.map((row, index) => (
              <div
                key={row.id}
                className="bg-brand-card border border-brand-border rounded-xl px-4 py-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xl shrink-0" aria-hidden>
                    {layoutEmoji(row.ticket_layout)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-brand-text font-medium">{getPrintStationDisplayName(row, lang)}</p>
                    <p className="text-[12px] text-brand-text-muted mt-0.5">{layoutLabel(row.ticket_layout)}</p>
                    <p className="text-[12px] text-brand-text-muted mt-0.5">{bindingsLabel(row.id)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-brand-border pt-3">
                  <button
                    type="button"
                    aria-label={t.moveUp}
                    disabled={index === 0}
                    onClick={() => moveRow(index, -1)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-brand-border/70 text-brand-text-muted disabled:opacity-35"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t.moveDown}
                    disabled={index === stations.length - 1}
                    onClick={() => moveRow(index, 1)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-brand-border/70 text-brand-text-muted disabled:opacity-35"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => openStationEditModal(row)}
                    className="text-brand-text-muted hover:text-brand-gold text-sm ml-auto"
                  >
                    {tm.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(row)}
                    className="mesa-text-danger text-sm"
                  >
                    {tm.remove}
                  </button>
                </div>
              </div>
            ))}
            <p className="text-[12px] text-brand-text-muted px-1">{t.sortOrderHint}</p>
          </div>
        </>
      )}

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
          <p className="text-sm text-brand-text">
            {deleteTarget && deleteTargetBindings
              ? t.confirmDeleteBody
                  .replace('{categories}', String(deleteTargetBindings.categories))
                  .replace('{dishes}', String(deleteTargetBindings.dishes))
                  .replace('{name}', getPrintStationDisplayName(deleteTarget, lang))
              : t.confirmDeleteBody}
          </p>
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
