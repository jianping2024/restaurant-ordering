'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import { useOrderHistoryFeed } from '@/lib/use-order-history-feed';
import { formatForcedUnpaidCloseAnnotation } from '@/lib/order-history/resolve-close-annotation-label';
import {
  ORDER_HISTORY_FORCED_SUMMARY_CLASS,
  buildOrderHistorySurfaceMeta,
} from '@/lib/order-history/build-lifecycle-presentation';
import {
  OrderHistoryLifecycleSteps,
  OrderHistoryOutcomeBadge,
} from '@/components/dashboard/OrderHistoryLifecycleSteps';
import {
  DashboardTableMultiSelect,
  type DashboardTableOption,
} from '@/components/dashboard/DashboardTableMultiSelect';
import { resolveBillPrintButtonLabel } from '@/lib/order-history/order-history-print-labels';
import {
  useStaffCheckoutBillPrint,
  staffBillPrintCooldownKey,
  staffSessionBillCooldownKey,
} from '@/lib/use-staff-checkout-bill-print';
import { OrderHistoryDetailModal } from '@/components/dashboard/OrderHistoryDetailModal';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { isOperationalSourceCloseKind } from '@/lib/order-history/close-kind';
import { defaultOrderHistoryClosedRange } from '@/lib/order-history/date-range';
import { LIST_DEFAULT_PAGE_SIZE, type ListPageSize } from '@/lib/paginate-list';
import type { CapabilitiesPayload } from '@/lib/permissions/can';

interface Props {
  initialItems: OrderHistoryEntry[];
  initialTotal: number;
  initialItemCodeByMenuId?: Record<string, string>;
  /** SSR today window — must match `defaultOrderHistoryClosedRange()`. */
  initialClosedFrom: string;
  initialClosedTo: string;
  tables?: RestaurantTableRow[];
  restaurantSlug: string;
  billSyncToFiscal?: boolean;
  capabilities?: CapabilitiesPayload;
}

const META_SEP = <span className="text-brand-text-muted/50" aria-hidden>·</span>;

export function OrdersHistoryManager({
  initialItems,
  initialTotal,
  initialItemCodeByMenuId = {},
  initialClosedFrom,
  initialClosedTo,
  tables = [],
  restaurantSlug,
  billSyncToFiscal = false,
  capabilities,
}: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const checkoutT = getMessages(lang).checkout;
  const {
    printCheckoutBill,
    printSessionCheckoutBill,
    isPrintBillBusy,
    isPrintSessionBillBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  } = useStaffCheckoutBillPrint(restaurantSlug);

  const todayRange = useMemo(() => defaultOrderHistoryClosedRange(), []);

  const {
    entries,
    total,
    itemCodeByMenuId,
    page,
    pageSize,
    loading,
    setFilters,
    goToPage,
    changePageSize,
  } = useOrderHistoryFeed({
    items: initialItems,
    total: initialTotal,
    itemCodeByMenuId: initialItemCodeByMenuId,
    filters: {
      tableIds: [],
      closedFrom: initialClosedFrom,
      closedTo: initialClosedTo,
    },
    page: 1,
    pageSize: LIST_DEFAULT_PAGE_SIZE,
  });

  const [selectedTables, setSelectedTables] = useState<DashboardTableOption[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<OrderHistoryEntry | null>(null);

  useEffect(() => {
    const tableIds = selectedTables.map((item) => item.value);
    setFilters({
      tableIds,
      closedFrom: todayRange.closedFrom,
      closedTo: todayRange.closedTo,
    });
  }, [selectedTables, setFilters, todayRange]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const renderMetaAmount = (entry: OrderHistoryEntry) => {
    const { listAmount, listAmountKind } = entry.settlement;
    if (listAmount == null) {
      return <span className="text-brand-text-muted">—</span>;
    }
    if (listAmountKind === 'collected') {
      return (
        <span className="text-brand-gold font-medium tabular-nums">
          {i18n.listAmountCollected} €{listAmount.toFixed(2)}
        </span>
      );
    }
    return (
      <span className="text-brand-gold font-medium tabular-nums">€{listAmount.toFixed(2)}</span>
    );
  };

  const renderPrintButton = (entry: OrderHistoryEntry) => {
    const billSplit = entry.billSplit;
    const splitId = billSplit?.id ?? '';
    const billCooldownKey = splitId
      ? staffBillPrintCooldownKey(splitId)
      : staffSessionBillCooldownKey(entry.sessionId);
    const busy = splitId
      ? isPrintBillBusy(splitId)
      : isPrintSessionBillBusy(entry.sessionId);
    const onCooldown = isOnCooldown(billCooldownKey);
    const canPrint = entry.settlement.canPrintBill;
    const label = resolveBillPrintButtonLabel(
      checkoutT,
      busy,
      onCooldown ? cooldownSecondsLeft(billCooldownKey) : 0,
    );

    if (!canPrint) return null;

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (billSplit) {
            void printCheckoutBill(billSplit);
            return;
          }
          void printSessionCheckoutBill(entry.tableId, entry.sessionId);
        }}
        disabled={busy || onCooldown}
        className="text-[13px] px-2.5 py-1 rounded-lg border border-brand-border text-brand-gold hover:border-brand-gold/50 transition-colors disabled:opacity-50 disabled:hover:border-brand-border"
      >
        {label}
      </button>
    );
  };

  const renderHistoryCard = (entry: OrderHistoryEntry) => {
    const isForcedUnpaidClose = entry.closeAnnotation.isForcedUnpaidClose;
    const forcedCloseSummary = isForcedUnpaidClose
      ? formatForcedUnpaidCloseAnnotation(lang, entry.closeAnnotation)?.summary ?? null
      : null;
    const { outcomeBadge, lifecycleSteps, cardClass, mergeSummaryLine } =
      buildOrderHistorySurfaceMeta(entry, i18n);
    const isOperationalSource = isOperationalSourceCloseKind(entry.closeKind);

    return (
      <div
        key={entry.historyRecordId}
        role="button"
        tabIndex={0}
        className={cardClass}
        onClick={() => setSelectedEntry(entry)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setSelectedEntry(entry);
          }
        }}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          <span className="font-medium text-brand-text">
            {i18n.table} {entry.displayName}
          </span>
          {META_SEP}
          <OrderHistoryOutcomeBadge badge={outcomeBadge} />
          {!isOperationalSource ? (
            <>
              {META_SEP}
              <span className="text-brand-text-muted">
                {entry.itemCount} {i18n.items}
              </span>
              {META_SEP}
              {renderMetaAmount(entry)}
              {renderPrintButton(entry)}
            </>
          ) : null}
        </div>
        <OrderHistoryLifecycleSteps
          steps={lifecycleSteps}
          i18n={i18n}
          className="mt-2 space-y-0.5 text-[13px] text-brand-text-muted"
        />
        {mergeSummaryLine ? (
          <p className="mt-0.5 text-[13px] text-brand-text">{mergeSummaryLine}</p>
        ) : null}
        {forcedCloseSummary ? (
          <p className={ORDER_HISTORY_FORCED_SUMMARY_CLASS}>{forcedCloseSummary}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <div className="bg-brand-card border border-brand-border rounded-xl p-4 mb-4">
        <DashboardTableMultiSelect
          tables={tables}
          value={selectedTables}
          onChange={setSelectedTables}
          tableWord={i18n.table}
          placeholder={i18n.filterTable}
          noOptionsMessage={i18n.empty}
          classNamePrefix="orders-table-select"
        />
      </div>

      {loading && entries.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted">{i18n.loading}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted">{i18n.empty}</p>
        </div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          <div className="space-y-3 p-3">
            {entries.map(renderHistoryCard)}
            {loading ? (
              <p className="py-2 text-center text-[13px] text-brand-text-muted">{i18n.loading}</p>
            ) : null}
          </div>
          <ListPaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            labels={{
              pageInfo: i18n.pageInfo,
              pageSizeLabel: i18n.pageSizeLabel,
              pageFirst: i18n.pageFirst,
              pagePrev: i18n.pagePrev,
              pageNext: i18n.pageNext,
              pageLast: i18n.pageLast,
            }}
            onPageChange={goToPage}
            onPageSizeChange={(next: ListPageSize) => changePageSize(next)}
            disabled={loading}
          />
        </div>
      )}

      <OrderHistoryDetailModal
        entry={selectedEntry}
        entries={entries}
        itemCodeByMenuId={itemCodeByMenuId}
        restaurantSlug={restaurantSlug}
        billSyncToFiscal={billSyncToFiscal}
        capabilities={capabilities}
        onClose={() => setSelectedEntry(null)}
        onSelectEntry={setSelectedEntry}
      />
    </div>
  );
}
