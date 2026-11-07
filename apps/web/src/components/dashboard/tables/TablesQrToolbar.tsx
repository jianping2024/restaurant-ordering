'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { RESTAURANT_TABLE_LIST_MAX } from '@/lib/restaurant-tables';
import { TABLE_QR_ALL_GROUPS, TABLE_QR_UNGROUPED } from '@/lib/table-qr-list';
import type { RestaurantTableGroup } from '@/lib/restaurant-table-groups';
import { dashboardStickyToolbarShellClass } from '@/lib/waiter-staff-sticky-chrome';

type Props = {
  totalCount: number;
  filteredCount: number;
  dirty: boolean;
  dirtyCount: number;
  saving: boolean;
  adding: boolean;
  addCount: number;
  maxAddCount: number;
  batchMode: boolean;
  search: string;
  groupId: string;
  groups: RestaurantTableGroup[];
  /** Optional batch chrome — stays inside the same sticky shell as save. */
  batchBar?: ReactNode;
  labels: {
    tableCountSummary: string;
    unsavedChanges: string;
    searchTable: string;
    clearSearch: string;
    allGroups: string;
    ungrouped: string;
    batchManage: string;
    exitBatchManage: string;
    addTableCountLabel: string;
    addTables: string;
    saveTables: string;
    print: string;
  };
  onSearchChange: (value: string) => void;
  onGroupChange: (groupId: string) => void;
  onToggleBatchMode: () => void;
  onAddCountChange: (count: number) => void;
  onAddTables: () => void;
  onSaveTables: () => void;
  onPrintAll: () => void;
};

export function TablesQrToolbar({
  totalCount,
  filteredCount,
  dirty,
  dirtyCount,
  saving,
  adding,
  addCount,
  maxAddCount,
  batchMode,
  search,
  groupId,
  groups,
  batchBar,
  labels: t,
  onSearchChange,
  onGroupChange,
  onToggleBatchMode,
  onAddCountChange,
  onAddTables,
  onSaveTables,
  onPrintAll,
}: Props) {
  const countLabel = t.tableCountSummary.replace('{count}', String(totalCount));
  const filteredHint =
    filteredCount !== totalCount ? ` · ${filteredCount}` : '';

  return (
    <>
      {/*
        Sticky sibling of the table shell (MenuManager pattern).
        No page H2 — tab「桌位配置」already names the page.
      */}
      <div className={`${dashboardStickyToolbarShellClass} mb-3`}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center flex-1 min-w-0">
              <span className="text-[12px] text-brand-text-muted shrink-0">
                {countLabel}
                {filteredHint ? (
                  <span className="text-brand-text-muted/80"> ({filteredCount})</span>
                ) : null}
                {dirty ? (
                  <span className="text-brand-gold">
                    {' '}
                    · {t.unsavedChanges}
                    {dirtyCount > 0 ? ` (${dirtyCount})` : ''}
                  </span>
                ) : null}
              </span>
              <div className="w-full sm:w-44">
                <Input
                  type="text"
                  role="searchbox"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t.searchTable}
                  aria-label={t.searchTable}
                  clearable
                  clearLabel={t.clearSearch}
                  className="bg-brand-card px-3 py-1.5 focus:ring-brand-gold/40 focus:border-brand-gold/40"
                />
              </div>
              <select
                value={groupId}
                onChange={(e) => onGroupChange(e.target.value)}
                className="w-full sm:w-36 rounded-lg bg-brand-card border border-brand-border px-3 py-1.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
              >
                <option value={TABLE_QR_ALL_GROUPS}>{t.allGroups}</option>
                <option value={TABLE_QR_UNGROUPED}>{t.ungrouped}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" variant={batchMode ? 'gold' : 'outline'} onClick={onToggleBatchMode}>
                {batchMode ? t.exitBatchManage : t.batchManage}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-brand-text-muted whitespace-nowrap">
                  {t.addTableCountLabel}
                </label>
                <IntegerInput
                  value={Math.min(addCount, maxAddCount)}
                  min={1}
                  max={maxAddCount}
                  disabled={adding || totalCount >= RESTAURANT_TABLE_LIST_MAX}
                  onChange={(n) => onAddCountChange(Math.max(1, Math.min(n, maxAddCount)))}
                  className="w-14 rounded-lg bg-brand-card border border-brand-border px-2 py-1 text-center text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
                  aria-label={t.addTableCountLabel}
                />
              </div>
              <Button
                onClick={onAddTables}
                size="sm"
                variant="outline"
                loading={adding}
                disabled={adding || totalCount >= RESTAURANT_TABLE_LIST_MAX}
              >
                {t.addTables}
              </Button>
              <Button onClick={onSaveTables} size="sm" loading={saving} disabled={!dirty}>
                {t.saveTables}
              </Button>
              <Button onClick={onPrintAll} variant="outline" size="sm" disabled={filteredCount === 0}>
                {t.print}
              </Button>
            </div>
          </div>

          {batchBar ? <div className="pt-0.5">{batchBar}</div> : null}
        </div>
      </div>
    </>
  );
}
