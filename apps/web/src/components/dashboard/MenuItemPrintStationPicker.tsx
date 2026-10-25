'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PrintStation } from '@/types';
import type { UILanguage } from '@/lib/i18n';
import { getPrintStationDisplayName } from '@/lib/print-station-admin';

type Props = {
  stations: PrintStation[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Shown when nothing selected (inherit). */
  inheritLabel: string;
  /** Optional resolved inherit station name for hint. */
  inheritStationName: string | null;
  searchPlaceholder: string;
  addLabel: string;
  emptyStationsHint: string;
  lang: UILanguage;
  hint: string;
  label: string;
};

/**
 * Sole dish→station binding control: selected tags + searchable add.
 * Empty selection = inherit category (not a wall of chips).
 */
export function MenuItemPrintStationPicker({
  stations,
  selectedIds,
  onChange,
  inheritLabel,
  inheritStationName,
  searchPlaceholder,
  addLabel,
  emptyStationsHint,
  lang,
  hint,
  label,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedStations = useMemo(
    () =>
      selectedIds
        .map((id) => stations.find((s) => s.id === id))
        .filter((s): s is PrintStation => Boolean(s)),
    [selectedIds, stations],
  );

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stations
      .filter((s) => !selectedSet.has(s.id))
      .filter((s) => {
        if (!q) return true;
        const name = getPrintStationDisplayName(s, lang).toLowerCase();
        const pt = (s.name_pt || '').toLowerCase();
        const en = (s.name_en || '').toLowerCase();
        const zh = (s.name_zh || '').toLowerCase();
        return name.includes(q) || pt.includes(q) || en.includes(q) || zh.includes(q);
      });
  }, [stations, selectedSet, query, lang]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const openPicker = () => {
    if (stations.length === 0) return;
    setOpen(true);
  };

  const addStation = (id: string) => {
    if (selectedSet.has(id)) return;
    onChange([...selectedIds, id]);
    setQuery('');
    setOpen(false);
  };

  const removeStation = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  return (
    <div ref={rootRef}>
      <p className="text-sm text-brand-text-muted font-medium mb-1.5">{label}</p>
      <div
        className={`rounded-lg border bg-brand-card px-2.5 py-2 ${
          open ? 'border-brand-gold/50 ring-2 ring-brand-gold/30' : 'border-brand-border'
        }`}
      >
        <div className="flex flex-wrap gap-1.5 items-center min-h-[2rem]">
          {selectedStations.length === 0 ? (
            <button
              type="button"
              onClick={openPicker}
              className="text-[13px] text-brand-text-muted px-1.5 py-1 rounded-md hover:bg-brand-bg/60"
            >
              {inheritStationName
                ? `${inheritLabel}（${inheritStationName}）`
                : inheritLabel}
            </button>
          ) : (
            selectedStations.map((st) => (
              <span
                key={st.id}
                className="inline-flex items-center gap-1 text-[13px] pl-2.5 pr-1 py-1 rounded-full border border-brand-gold/40 bg-brand-gold/10 text-brand-gold font-medium"
              >
                {getPrintStationDisplayName(st, lang)}
                <button
                  type="button"
                  aria-label={`remove ${getPrintStationDisplayName(st, lang)}`}
                  onClick={() => removeStation(st.id)}
                  className="rounded-full px-1.5 text-brand-gold/70 hover:text-brand-gold hover:bg-brand-gold/15"
                >
                  ×
                </button>
              </span>
            ))
          )}
          {stations.length > 0 ? (
            <button
              type="button"
              onClick={openPicker}
              className="text-[13px] px-2 py-1 rounded-full border border-dashed border-brand-gold/40 text-brand-gold font-medium hover:bg-brand-gold/10"
            >
              {addLabel}
            </button>
          ) : null}
        </div>

        {open ? (
          <div className="mt-2 pt-2 border-t border-brand-border">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              aria-controls={listId}
              aria-autocomplete="list"
            />
            <ul id={listId} role="listbox" className="mt-1.5 max-h-40 overflow-y-auto">
              {available.length === 0 ? (
                <li className="px-3 py-2 text-[13px] text-brand-text-muted">—</li>
              ) : (
                available.map((st) => (
                  <li key={st.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="w-full text-left px-3 py-2 text-sm rounded-lg text-brand-text hover:bg-brand-gold/10"
                      onClick={() => addStation(st.id)}
                    >
                      {getPrintStationDisplayName(st, lang)}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="text-[12px] text-brand-text-muted mt-1">
        {stations.length === 0 ? emptyStationsHint : hint}
      </p>
    </div>
  );
}
