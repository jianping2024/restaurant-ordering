'use client';

import { useDashboardStore } from '@/components/dashboard/DashboardStoreProvider';
import { useCallback, useState } from 'react';
import type { BuffetUpdatePatch } from '@/lib/buffet-update-patch';
import type { BuffetTimeSlot } from '@/types';
import { dbTimeToHm, hmToDbTime } from '@/lib/buffet-pricing-admin';
import {
  mergeBuffetDashboardPatch,
  type BuffetDashboardPatch,
} from '@/lib/buffet-dashboard-patch';
import type { BuffetDashboardData } from '@/lib/dashboard-buffet-server';
import {
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

function fridayDraftFromData(data: BuffetDashboardData) {
  const from = data.buffet_friday_weekend_from;
  return {
    enabled: !!from,
    draftFrom: dbTimeToHm(from) || '18:00',
  };
}

export function useBuffetDashboard(initialData: BuffetDashboardData) {
  const { slug: storeSlug } = useDashboardStore();
  const [data, setData] = useState(initialData);
  const initialFriday = fridayDraftFromData(initialData);
  const [fridayEnabled, setFridayEnabled] = useState(initialFriday.enabled);
  const [fridayDraftFrom, setFridayDraftFrom] = useState(initialFriday.draftFrom);
  const [fridaySaving, setFridaySaving] = useState(false);

  const applyPatch = useCallback((patch: BuffetDashboardPatch) => {
    setData((prev) => {
      const next = mergeBuffetDashboardPatch(prev, patch);
      if (patch.buffet_friday_weekend_from !== undefined) {
        const friday = fridayDraftFromData(next);
        setFridayEnabled(friday.enabled);
        setFridayDraftFrom(friday.draftFrom);
      }
      return next;
    });
  }, []);

  const createBuffet = useCallback(
    async (name: string) => {
      const result = await createBuffetClient(storeSlug, name);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const createSlot = useCallback(
    async (name: string, sortOrder: number) => {
      const result = await createBuffetSlotClient(storeSlug, name, sortOrder);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const deleteBuffet = useCallback(
    async (id: string) => {
      const result = await deleteBuffetClient(storeSlug, id);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const deleteSlot = useCallback(
    async (id: string) => {
      const result = await deleteBuffetSlotClient(storeSlug, id);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const deleteRule = useCallback(
    async (id: string) => {
      const result = await deleteBuffetRuleClient(storeSlug, id);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const deleteCalendar = useCallback(
    async (onDate: string) => {
      const result = await deleteBuffetCalendarClient(storeSlug, onDate);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const updateBuffet = useCallback(
    async (id: string, patch: BuffetUpdatePatch) => {
      const result = await updateBuffetClient(storeSlug, id, patch);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const updateSlot = useCallback(
    async (id: string, patch: Partial<BuffetTimeSlot>) => {
      const result = await updateBuffetSlotClient(storeSlug, id, patch);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const createRule = useCallback(
    async (payload: Record<string, unknown>) => {
      const result = await createBuffetRuleClient(storeSlug, payload);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const updateRule = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      const result = await updateBuffetRuleClient(storeSlug, id, payload);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const toggleRuleActive = useCallback(
    async (id: string, isActive: boolean) => {
      const result = await toggleBuffetRuleActiveClient(storeSlug, id, isActive);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const upsertCalendar = useCallback(
    async (rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>) => {
      const result = await upsertBuffetCalendarClient(storeSlug, rows);
      if (result.ok) applyPatch(result.patch);
      return result;
    },
    [applyPatch, storeSlug],
  );

  const saveFridayPolicy = useCallback(async () => {
    let dbValue: string | null = null;
    if (fridayEnabled) {
      dbValue = hmToDbTime(fridayDraftFrom);
      if (!dbValue) return { ok: false as const, error: 'invalid_time' };
    }
    setFridaySaving(true);
    try {
      const result = await updateBuffetFridayPolicyClient(storeSlug, dbValue);
      if (result.ok) applyPatch(result.patch);
      return result;
    } finally {
      setFridaySaving(false);
    }
  }, [applyPatch, fridayDraftFrom, fridayEnabled, storeSlug]);

  return {
    buffets: data.buffets,
    slots: data.slots,
    rules: data.rules,
    calendarRows: data.calendarRows,
    fridayWeekendFrom: data.buffet_friday_weekend_from,
    fridayEnabled,
    fridayDraftFrom,
    fridaySaving,
    setFridayEnabled,
    setFridayDraftFrom,
    createBuffet,
    createSlot,
    deleteBuffet,
    deleteSlot,
    deleteRule,
    deleteCalendar,
    updateBuffet,
    updateSlot,
    createRule,
    updateRule,
    toggleRuleActive,
    upsertCalendar,
    saveFridayPolicy,
  };
}
