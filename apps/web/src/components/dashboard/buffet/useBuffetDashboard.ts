'use client';

import { useCallback, useState } from 'react';
import type { Buffet, BuffetTimeSlot } from '@/types';
import { dbTimeToHm, hmToDbTime } from '@/lib/buffet-pricing-admin';
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
  const [data, setData] = useState(initialData);
  const initialFriday = fridayDraftFromData(initialData);
  const [fridayEnabled, setFridayEnabled] = useState(initialFriday.enabled);
  const [fridayDraftFrom, setFridayDraftFrom] = useState(initialFriday.draftFrom);
  const [fridaySaving, setFridaySaving] = useState(false);

  const applyData = useCallback((next: BuffetDashboardData) => {
    setData(next);
    const friday = fridayDraftFromData(next);
    setFridayEnabled(friday.enabled);
    setFridayDraftFrom(friday.draftFrom);
  }, []);

  const createBuffet = useCallback(
    async (name: string) => {
      const result = await createBuffetClient(name);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const createSlot = useCallback(
    async (name: string, sortOrder: number) => {
      const result = await createBuffetSlotClient(name, sortOrder);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const deleteBuffet = useCallback(
    async (id: string) => {
      const result = await deleteBuffetClient(id);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const deleteSlot = useCallback(
    async (id: string) => {
      const result = await deleteBuffetSlotClient(id);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const deleteRule = useCallback(
    async (id: string) => {
      const result = await deleteBuffetRuleClient(id);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const deleteCalendar = useCallback(
    async (onDate: string) => {
      const result = await deleteBuffetCalendarClient(onDate);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const updateBuffet = useCallback(
    async (id: string, patch: Partial<Pick<Buffet, 'name' | 'is_active'>>) => {
      const result = await updateBuffetClient(id, patch);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const updateSlot = useCallback(
    async (id: string, patch: Partial<BuffetTimeSlot>) => {
      const result = await updateBuffetSlotClient(id, patch);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const createRule = useCallback(
    async (payload: Record<string, unknown>) => {
      const result = await createBuffetRuleClient(payload);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const updateRule = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      const result = await updateBuffetRuleClient(id, payload);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const toggleRuleActive = useCallback(
    async (id: string, isActive: boolean) => {
      const result = await toggleBuffetRuleActiveClient(id, isActive);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const upsertCalendar = useCallback(
    async (rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>) => {
      const result = await upsertBuffetCalendarClient(rows);
      if (result.ok) applyData(result.data);
      return result;
    },
    [applyData],
  );

  const saveFridayPolicy = useCallback(async () => {
    let dbValue: string | null = null;
    if (fridayEnabled) {
      dbValue = hmToDbTime(fridayDraftFrom);
      if (!dbValue) return { ok: false as const, error: 'invalid_time' };
    }
    setFridaySaving(true);
    try {
      const result = await updateBuffetFridayPolicyClient(dbValue);
      if (result.ok) applyData(result.data);
      return result;
    } finally {
      setFridaySaving(false);
    }
  }, [applyData, fridayDraftFrom, fridayEnabled]);

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
