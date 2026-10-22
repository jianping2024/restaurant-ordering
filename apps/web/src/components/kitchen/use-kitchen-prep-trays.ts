'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '@/components/ui/Toast';
import {
  EMPTY_PREP_TRAY,
  groupLineKeysByStation,
  type KitchenBoardLine,
  type PrepTrayState,
} from '@/components/kitchen/kitchen-board-lines';
import type { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import { loadPrepTrayStored, savePrepTrayStored } from '@/lib/kitchen-prep-tray-storage';
import type { UILanguage } from '@/lib/i18n';

type Labels = (typeof KITCHEN_SCREEN_TEXT)[UILanguage];

type Selection = { order_id: string; item_index: number };

/** `tray` = prep-tray button (clears that station's skipped chips too); `swipe` = one row. */
export type KitchenPrepSource = 'tray' | 'swipe';

function withoutKeys(set: Set<string>, keys: ReadonlySet<string>): Set<string> {
  if (!Array.from(keys).some((k) => set.has(k))) return set;
  const next = new Set(set);
  keys.forEach((k) => next.delete(k));
  return next;
}

/**
 * Sole kitchen-screen prep tray state: per-station `selected`/`skipped` (both tray layouts read it),
 * local persistence per station, «taken elsewhere» hygiene, prep in-flight keys and ready-rail open.
 * Station panes and the shared tray are views over this — never a second selection state.
 */
export function useKitchenPrepTrays(input: {
  stationIds: readonly string[];
  linesByStation: ReadonlyMap<string, readonly KitchenBoardLine[]>;
  t: Labels;
  /** One station per call; returns true when the prep API/demo succeeded. */
  postPrep: (stationId: string, selections: Selection[]) => Promise<boolean>;
}) {
  const { stationIds, linesByStation, t, postPrep } = input;
  const stationKey = stationIds.join(',');
  const [trays, setTrays] = useState<Record<string, PrepTrayState>>({});
  const [loaded, setLoaded] = useState(false);
  /** Sole prep in-flight line keys (keys are unique across stations). */
  const [prepInFlightKeys, setPrepInFlightKeys] = useState<Set<string>>(() => new Set());
  const [railOpenStations, setRailOpenStations] = useState<Set<string>>(() => new Set());
  const prepInFlight = prepInFlightKeys.size > 0;

  const trayFor = useCallback(
    (stationId: string): PrepTrayState => trays[stationId] ?? EMPTY_PREP_TRAY,
    [trays],
  );

  const updateTray = useCallback(
    (stationId: string, fn: (prev: PrepTrayState) => PrepTrayState) => {
      setTrays((prev) => {
        const cur = prev[stationId] ?? EMPTY_PREP_TRAY;
        const next = fn(cur);
        if (next.selected === cur.selected && next.skipped === cur.skipped) return prev;
        return { ...prev, [stationId]: next };
      });
    },
    [],
  );

  /** Shared-tray edits arrive as line keys; route each to its owning station. */
  const updateTrayKeys = useCallback(
    (keys: readonly string[], fn: (keys: string[], prev: PrepTrayState) => PrepTrayState) => {
      groupLineKeysByStation(keys, linesByStation).forEach((stationKeys, stationId) =>
        updateTray(stationId, (prev) => fn(stationKeys, prev)),
      );
    },
    [linesByStation, updateTray],
  );

  useEffect(() => {
    const next: Record<string, PrepTrayState> = {};
    for (const stationId of stationKey.split(',').filter(Boolean)) {
      const stored = loadPrepTrayStored(stationId);
      if (stored) {
        next[stationId] = { selected: new Set(stored.selected), skipped: new Set(stored.skipped) };
      }
    }
    setTrays(next);
    setLoaded(true);
  }, [stationKey]);

  useEffect(() => {
    if (!loaded) return;
    for (const stationId of stationIds) {
      const tray = trays[stationId] ?? EMPTY_PREP_TRAY;
      const lines = linesByStation.get(stationId) ?? [];
      const printKeys = new Set(lines.filter((l) => l.printEligible).map((l) => l.key));
      savePrepTrayStored(stationId, {
        selected: Array.from(tray.selected).filter((k) => !printKeys.has(k)),
        skipped: Array.from(tray.skipped),
      });
    }
  }, [loaded, stationIds, trays, linesByStation]);

  /**
   * Local selection hygiene per station: rows that vanished from the board drop out silently; tray
   * rows that were pending a moment ago and are no longer (prepped / cancelled on another screen)
   * drop out with one toast. Skipped while our own prep is in flight (its refresh is not «others»).
   */
  const prevPrepKeysRef = useRef<Map<string, Set<string>>>(new Map());
  useEffect(() => {
    if (!loaded) return;
    let takenElsewhereCount = 0;
    for (const stationId of stationIds) {
      const lines = linesByStation.get(stationId) ?? [];
      const prepKeys = new Set(lines.filter((l) => l.prepEligible).map((l) => l.key));
      const prevPrepKeys = prevPrepKeysRef.current.get(stationId) ?? new Set<string>();
      prevPrepKeysRef.current.set(stationId, prepKeys);
      if (lines.length === 0 || prepInFlight) continue;
      const tray = trays[stationId] ?? EMPTY_PREP_TRAY;
      const live = new Set(lines.map((l) => l.key));
      const trayKeys = Array.from(tray.selected).concat(Array.from(tray.skipped));
      const takenElsewhere = new Set(
        trayKeys.filter((k) => prevPrepKeys.has(k) && !prepKeys.has(k)),
      );
      const drop = new Set(trayKeys.filter((k) => takenElsewhere.has(k) || !live.has(k)));
      if (drop.size > 0) {
        updateTray(stationId, (prev) => ({
          selected: withoutKeys(prev.selected, drop),
          skipped: withoutKeys(prev.skipped, drop),
        }));
      }
      takenElsewhereCount += takenElsewhere.size;
    }
    if (takenElsewhereCount > 0) {
      showToast(t.trayDroppedByOthers.replace('{n}', String(takenElsewhereCount)), 'info');
    }
  }, [loaded, stationIds, linesByStation, trays, prepInFlight, updateTray, t]);

  const setRailOpen = useCallback((stationId: string, open: boolean) => {
    setRailOpenStations((prev) => {
      if (prev.has(stationId) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(stationId);
      else next.delete(stationId);
      return next;
    });
  }, []);

  /**
   * Sole prep runner (pane tray button, row swipe, shared tray). Posts station batches one after
   * another; each success clears its lines and opens that station's ready rail. Returns the
   * station ids whose prep failed (their selection stays in the tray).
   */
  const runPrep = useCallback(
    async (
      batches: ReadonlyArray<{ stationId: string; lines: readonly KitchenBoardLine[] }>,
      source: KitchenPrepSource,
    ): Promise<string[]> => {
      const all = batches.flatMap((b) => b.lines);
      if (all.length === 0) {
        showToast(t.selectLines, 'info');
        return [];
      }
      setPrepInFlightKeys(new Set(all.map((l) => l.key)));
      const failed: string[] = [];
      try {
        for (const batch of batches) {
          const ok = await postPrep(
            batch.stationId,
            batch.lines.map((l) => ({ order_id: l.orderId, item_index: l.itemIndex })),
          );
          if (!ok) {
            failed.push(batch.stationId);
            continue;
          }
          const keys = new Set(batch.lines.map((l) => l.key));
          updateTray(batch.stationId, (prev) => ({
            selected: withoutKeys(prev.selected, keys),
            skipped: source === 'tray' ? new Set() : withoutKeys(prev.skipped, keys),
          }));
          setRailOpen(batch.stationId, true);
        }
        if (failed.length < batches.length) showToast(t.prepSuccess, 'success');
      } finally {
        setPrepInFlightKeys(new Set());
      }
      return failed;
    },
    [postPrep, setRailOpen, t, updateTray],
  );

  return useMemo(
    () => ({
      trays,
      trayFor,
      updateTray,
      updateTrayKeys,
      prepInFlightKeys,
      runPrep,
      railOpenStations,
      setRailOpen,
    }),
    [trays, trayFor, updateTray, updateTrayKeys, prepInFlightKeys, runPrep, railOpenStations, setRailOpen],
  );
}
