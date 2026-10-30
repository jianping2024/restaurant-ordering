'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { KitchenDishThumbButton } from '@/components/kitchen/KitchenDishThumbButton';
import { KitchenLineNote } from '@/components/kitchen/KitchenLineNote';
import type { PrepTrayCard } from '@/components/kitchen/kitchen-board-lines';
import { summarizePrepTray } from '@/components/kitchen/kitchen-board-lines';
import type { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import type { UILanguage } from '@/lib/i18n';

type Labels = (typeof KITCHEN_SCREEN_TEXT)[UILanguage];

/** Chips shown before「+N 桌」fold (~3 rows at kitchen-screen width). */
const TRAY_CHIPS_COLLAPSED = 24;

const CHIP_BASE_CLASS =
  'inline-flex h-10 min-w-[3.5rem] items-center justify-center gap-1 rounded-lg border px-2 text-xl font-medium tabular-nums disabled:opacity-50';
const CHIP_SELECTED_CLASS = 'border-brand-gold bg-brand-gold/20 text-brand-text';
const CHIP_SKIPPED_CLASS = 'border-dashed border-brand-border text-brand-text-muted';

/**
 * One station's cards. A station pane passes one untitled section; the shared screen tray passes
 * one titled section per station (screen order) — cards never mix stations.
 */
export type PrepTraySection = {
  stationId: string;
  /** Station name heading; null = single-station tray (no heading). */
  title: string | null;
  cards: PrepTrayCard[];
};

type Props = {
  sections: PrepTraySection[];
  t: Labels;
  /** Parent board busy ∪ local in-flight (sole prep lock). */
  prepLocked: boolean;
  thumbFor: (card: PrepTrayCard) => { imageUrl: string | null; emoji: string };
  onOpenDetail: (card: PrepTrayCard) => void;
  onToggleChip: (key: string) => void;
  onSetCard: (keys: string[], on: boolean) => void;
  onRemoveKeys: (keys: string[]) => void;
  onPrep: () => void;
};

/**
 * Sole kitchen prep tray: every row the cook selected (either view), grouped by dish + note with
 * the big photo, selected portions and table chips (longest wait first). Note chrome sole
 * `KitchenLineNote` tray strip. Owns the sole prep button. Mounted per station pane, or once per
 * screen with station sections (shared prep tray).
 */
export function KitchenPrepTray({
  sections,
  t,
  prepLocked,
  thumbFor,
  onOpenDetail,
  onToggleChip,
  onSetCard,
  onRemoveKeys,
  onPrep,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const cards = sections.flatMap((section) => section.cards);
  const summary = summarizePrepTray(cards);
  const allKeys = cards.flatMap((c) => c.chips.map((chip) => chip.key));
  const visibleSections = sections.filter((section) => section.cards.length > 0);
  /** Shared tray: prep posts once per station that has selected portions. */
  const stationTickets = sections.filter(
    (section) => section.title !== null && section.cards.some((c) => c.selectedCount > 0),
  ).length;

  const toggleExpanded = (cardKey: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });

  const renderCard = (stationId: string, card: PrepTrayCard) => {
    const thumb = thumbFor(card);
    const keys = card.chips.map((chip) => chip.key);
    const expandKey = `${stationId}\0${card.cardKey}`;
    const open = expanded.has(expandKey);
    const shown = open ? card.chips : card.chips.slice(0, TRAY_CHIPS_COLLAPSED);
    const hidden = card.chips.length - shown.length;
    const allSelected = card.selectedCount === card.chips.length;
    return (
      <section
        key={card.cardKey}
        className="flex gap-3 rounded-xl border border-brand-border bg-brand-card p-3"
      >
        <KitchenDishThumbButton
          imageUrl={thumb.imageUrl}
          emoji={thumb.emoji}
          size={160}
          ariaLabel={t.dishThumbOpenDetail}
          onOpen={() => onOpenDetail(card)}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="mesa-kitchen-tray-card-name min-w-0 truncate text-2xl font-medium text-brand-text">
              {card.name}
            </span>
            <span className="shrink-0 text-2xl font-semibold tabular-nums text-brand-gold">
              {t.portionBadge.replace('{n}', String(card.selectedQty))}
            </span>
            <span className="shrink-0 text-lg text-brand-text-muted">
              {t.tableCount.replace('{n}', String(card.selectedTableCount))}
            </span>
            <span className="shrink-0 text-lg tabular-nums text-brand-text-muted">
              {t.longestWait.replace('{n}', String(card.longestWaitMin))}
            </span>
          </div>
          <KitchenLineNote note={card.note} variant="tray" label={t.noteLabel} />
          <div className="flex flex-wrap items-baseline gap-x-4 text-lg text-brand-text-muted">
            <span className="tabular-nums">
              {t.selectedOf
                .replace('{n}', String(card.selectedCount))
                .replace('{m}', String(card.chips.length))}
            </span>
            <button
              type="button"
              className="text-brand-gold disabled:opacity-50"
              disabled={prepLocked}
              onClick={() => onSetCard(keys, !allSelected)}
            >
              {allSelected ? t.trayClear : t.selectAll}
            </button>
            <button
              type="button"
              className="hover:text-brand-text disabled:opacity-50"
              disabled={prepLocked}
              onClick={() => onRemoveKeys(keys)}
            >
              {t.trayRemoveDish} ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shown.map((chip) => (
              <button
                key={chip.key}
                type="button"
                disabled={prepLocked}
                aria-pressed={chip.selected}
                className={`${CHIP_BASE_CLASS} ${chip.selected ? CHIP_SELECTED_CLASS : CHIP_SKIPPED_CLASS}`}
                onClick={() => onToggleChip(chip.key)}
              >
                <span>{chip.tableDisplay}</span>
                {chip.qty > 1 ? (
                  <span className="text-base font-normal">×{chip.qty}</span>
                ) : null}
              </button>
            ))}
            {hidden > 0 ? (
              <button
                type="button"
                className={`${CHIP_BASE_CLASS} border-brand-border text-brand-text-muted`}
                onClick={() => toggleExpanded(expandKey)}
              >
                {t.trayMoreTables.replace('{n}', String(hidden))}
              </button>
            ) : open && card.chips.length > TRAY_CHIPS_COLLAPSED ? (
              <button
                type="button"
                className={`${CHIP_BASE_CLASS} border-brand-border text-brand-text-muted`}
                onClick={() => toggleExpanded(expandKey)}
              >
                {t.trayLessTables}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  };

  return (
    <aside
      data-kitchen-prep-tray=""
      className="mesa-kitchen-tray flex min-h-0 min-w-0 flex-1 flex-col bg-brand-bg"
      aria-label={t.trayTitle}
    >
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 border-b border-brand-border/70 px-3 py-2">
        <h3 className="text-xl font-semibold text-brand-text">{t.trayTitle}</h3>
        <div className="flex items-baseline gap-3">
          <span className="text-lg tabular-nums text-brand-text-muted">
            {t.traySummary
              .replace('{d}', String(summary.dishCount))
              .replace('{p}', String(summary.portions))
              .replace('{t}', String(summary.tableCount))}
          </span>
          {cards.length > 0 ? (
            <button
              type="button"
              className="text-lg text-brand-text-muted hover:text-brand-text disabled:opacity-50"
              disabled={prepLocked}
              onClick={() => setConfirmClear(true)}
            >
              {t.trayClearAll}
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none px-3 py-3">
        {cards.length === 0 ? (
          <p className="py-16 text-center text-2xl text-brand-text-muted">{t.trayEmpty}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleSections.map((section) => {
              const sectionSummary = summarizePrepTray(section.cards);
              return (
                <div key={section.stationId || 'tray'} className="flex flex-col gap-3">
                  {section.title !== null ? (
                    <div
                      data-kitchen-prep-tray-station=""
                      className="flex items-baseline gap-3 border-b border-brand-border/70 pb-1 pt-1"
                    >
                      <h4 className="min-w-0 truncate font-heading text-xl text-brand-gold">
                        {section.title}
                      </h4>
                      <span className="shrink-0 text-lg tabular-nums text-brand-text-muted">
                        {t.traySummary
                          .replace('{d}', String(sectionSummary.dishCount))
                          .replace('{p}', String(sectionSummary.portions))
                          .replace('{t}', String(sectionSummary.tableCount))}
                      </span>
                    </div>
                  ) : null}
                  {section.cards.map((card) => renderCard(section.stationId, card))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-4 border-t border-brand-border/70 bg-brand-card px-3 py-2">
        {stationTickets > 1 ? (
          <span className="text-lg text-brand-text-muted">
            {t.trayStationTickets.replace('{n}', String(stationTickets))}
          </span>
        ) : null}
        <Button
          type="button"
          className="min-h-11 px-8 text-xl"
          disabled={prepLocked}
          loading={prepLocked}
          onClick={onPrep}
        >
          {prepLocked ? t.prepBusy : t.prep}
        </Button>
      </div>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t.trayClearAllTitle}
        message={t.trayClearAllMessage}
        confirmLabel={t.trayClearAll}
        cancelLabel={t.trayCancel}
        variant="danger"
        onConfirm={() => {
          onRemoveKeys(allKeys);
          setConfirmClear(false);
        }}
      />
    </aside>
  );
}
