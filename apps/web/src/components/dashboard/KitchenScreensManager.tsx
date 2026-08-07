'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { getPrintStationDisplayName } from '@/lib/print-station-admin';
import type { KitchenScreen, PrintStation } from '@/types';

const KITCHEN_SCREEN_MAX_STATIONS = 2;
type Props = {
  initialScreens: KitchenScreen[];
  kitchenStations: PrintStation[];
};

async function apiJson<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch('/api/dashboard/kitchen-screens', {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) return { ok: false, error: data.error || 'request_failed' };
  return { ok: true, data };
}

export function KitchenScreensManager({ initialScreens, kitchenStations }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).kitchenScreens;
  const [screens, setScreens] = useState(initialScreens);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KitchenScreen | null>(null);
  const [name, setName] = useState('');
  const [stationIds, setStationIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KitchenScreen | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setScreens(initialScreens);
  }, [initialScreens]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setStationIds([]);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (screen: KitchenScreen) => {
    setEditing(screen);
    setName(screen.name);
    setStationIds([...screen.station_ids]);
    setError('');
    setModalOpen(true);
  };

  const toggleStation = (id: string) => {
    setStationIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= KITCHEN_SCREEN_MAX_STATIONS) return prev;
      return [...prev, id];
    });
  };

  const save = useCallback(async () => {
    if (!name.trim()) {
      setError(t.nameRequired);
      return;
    }
    if (stationIds.length === 0) {
      setError(t.stationsRequired);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const result = await apiJson<{ screen: KitchenScreen }>('PATCH', {
          screen_id: editing.id,
          name: name.trim(),
          station_ids: stationIds,
        });
        if (!result.ok) throw new Error(result.error);
        setScreens((prev) =>
          prev.map((s) => (s.id === editing.id ? result.data.screen : s)),
        );
      } else {
        const result = await apiJson<{ screen: KitchenScreen }>('POST', {
          name: name.trim(),
          station_ids: stationIds,
        });
        if (!result.ok) throw new Error(result.error);
        setScreens((prev) => [...prev, result.data.screen]);
      }
      setModalOpen(false);
    } catch {
      setError(t.saveFail);
    } finally {
      setSaving(false);
    }
  }, [editing, name, stationIds, t]);

  const runDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    const result = await apiJson<{ ok: true }>('DELETE', { screen_id: deleteTarget.id });
    setDeleting(false);
    if (!result.ok) {
      setError(t.deleteFail);
      return;
    }
    setScreens((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const stationLabel = (id: string) => {
    const st = kitchenStations.find((s) => s.id === id);
    return st ? getPrintStationDisplayName(st, lang) : id.slice(0, 8);
  };

  return (
    <div className="w-full max-w-full space-y-4">
      {error && !modalOpen ? (
        <p className="mesa-alert-danger text-sm px-4 py-2">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={openCreate} disabled={kitchenStations.length === 0}>
          + {t.add}
        </Button>
      </div>

      {kitchenStations.length === 0 ? (
        <p className="text-sm text-brand-text-muted rounded-xl border border-dashed border-brand-border px-4 py-8 text-center">
          {t.noKitchenStations}
        </p>
      ) : screens.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-10 text-center">
          <p className="text-brand-text-muted text-sm mb-4">{t.empty}</p>
          <Button type="button" onClick={openCreate}>
            {t.emptyCta}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {screens.map((screen) => (
            <li
              key={screen.id}
              className="bg-brand-card border border-brand-border rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-brand-text">{screen.name}</p>
                <p className="text-[12px] text-brand-text-muted mt-0.5">
                  {screen.station_ids.map(stationLabel).join(' · ') || t.noStations}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-brand-text-muted hover:text-brand-gold px-2 py-1"
                onClick={() => openEdit(screen)}
              >
                {t.edit}
              </button>
              <button
                type="button"
                className="text-sm mesa-text-danger px-2 py-1"
                onClick={() => setDeleteTarget(screen)}
              >
                {t.delete}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!saving) setModalOpen(false);
        }}
        title={editing ? t.modalEdit : t.modalAdd}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label={t.nameLabel}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
          />
          <div>
            <p className="text-sm text-brand-text mb-2">
              {t.stationsLabel.replace('{max}', String(KITCHEN_SCREEN_MAX_STATIONS))}
            </p>
            <div className="space-y-2">
              {kitchenStations.map((st) => {
                const checked = stationIds.includes(st.id);
                const disabled = !checked && stationIds.length >= KITCHEN_SCREEN_MAX_STATIONS;
                return (
                  <label
                    key={st.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                      disabled ? 'opacity-50' : 'cursor-pointer'
                    } ${checked ? 'border-brand-gold/45 bg-brand-gold/8' : 'border-brand-border'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleStation(st.id)}
                    />
                    <span className="text-sm text-brand-text">
                      {getPrintStationDisplayName(st, lang)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          {error ? <p className="mesa-alert-danger text-sm px-4 py-2">{error}</p> : null}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button onClick={() => void save()} loading={saving} className="flex-1">
              {t.save}
            </Button>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        title={t.confirmDeleteTitle}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-text">
            {t.confirmDeleteBody.replace('{name}', deleteTarget?.name || '')}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={() => void runDelete()} loading={deleting}>
              {t.confirmDelete}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
