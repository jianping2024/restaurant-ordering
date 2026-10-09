'use client';

import Image from 'next/image';
import { useId, useState } from 'react';
import type { Language } from '@/types';
import { MENU_IMAGE_UNOPTIMIZED } from '@/lib/menu-image';

/** Display cover height — locked product range 150–180px. */
export const CUSTOMER_STOREFRONT_COVER_HEIGHT_CLASS = 'h-[168px]';

export type CustomerStorefrontHoursWindow = {
  open: string;
  close: string;
};

export type CustomerStorefrontDayHours = {
  /** 1=Mon … 7=Sun */
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  windows: CustomerStorefrontHoursWindow[];
};

export type CustomerStorefrontIntroI18n = {
  pt: string;
  en: string;
  zh: string;
};

export type CustomerStorefrontBandModel = {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  intro: CustomerStorefrontIntroI18n;
  address: string;
  phone: string;
  /** Maps deep link or empty → caller builds from geo/address. */
  mapsUrl: string;
  /** Today’s windows for the compact toolbar + “open until”. */
  todayWindows: CustomerStorefrontHoursWindow[];
  weekHours: CustomerStorefrontDayHours[];
  openNow: boolean;
  openUntilLabel: string | null;
};

type Copy = {
  openNow: string;
  closedNow: string;
  openUntil: string;
  hours: string;
  navigate: string;
  call: string;
  introMore: string;
  introLess: string;
  weekTitle: string;
  addressTitle: string;
  weekdayLabels: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, string>;
};

const COPY: Record<Language, Copy> = {
  zh: {
    openNow: '营业中',
    closedNow: '休息中',
    openUntil: '营业至 {time}',
    hours: '营业时间',
    navigate: '导航',
    call: '电话',
    introMore: '展开介绍',
    introLess: '收起',
    weekTitle: '本周营业时间',
    addressTitle: '地址',
    weekdayLabels: {
      1: '周一',
      2: '周二',
      3: '周三',
      4: '周四',
      5: '周五',
      6: '周六',
      7: '周日',
    },
  },
  en: {
    openNow: 'Open',
    closedNow: 'Closed',
    openUntil: 'Until {time}',
    hours: 'Hours',
    navigate: 'Map',
    call: 'Call',
    introMore: 'About',
    introLess: 'Less',
    weekTitle: 'Opening hours',
    addressTitle: 'Address',
    weekdayLabels: {
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
      5: 'Fri',
      6: 'Sat',
      7: 'Sun',
    },
  },
  pt: {
    openNow: 'Aberto',
    closedNow: 'Fechado',
    openUntil: 'Até {time}',
    hours: 'Horário',
    navigate: 'Mapa',
    call: 'Telefone',
    introMore: 'Sobre',
    introLess: 'Menos',
    weekTitle: 'Horário da semana',
    addressTitle: 'Morada',
    weekdayLabels: {
      1: 'Seg',
      2: 'Ter',
      3: 'Qua',
      4: 'Qui',
      5: 'Sex',
      6: 'Sáb',
      7: 'Dom',
    },
  },
  es: {
    openNow: 'Abierto',
    closedNow: 'Cerrado',
    openUntil: 'Hasta {time}',
    hours: 'Horario',
    navigate: 'Mapa',
    call: 'Llamar',
    introMore: 'Sobre',
    introLess: 'Menos',
    weekTitle: 'Horario semanal',
    addressTitle: 'Dirección',
    weekdayLabels: {
      1: 'Lun',
      2: 'Mar',
      3: 'Mié',
      4: 'Jue',
      5: 'Vie',
      6: 'Sáb',
      7: 'Dom',
    },
  },
  fr: {
    openNow: 'Ouvert',
    closedNow: 'Fermé',
    openUntil: "Jusqu'à {time}",
    hours: 'Horaires',
    navigate: 'Carte',
    call: 'Appeler',
    introMore: 'À propos',
    introLess: 'Moins',
    weekTitle: 'Horaires de la semaine',
    addressTitle: 'Adresse',
    weekdayLabels: {
      1: 'Lun',
      2: 'Mar',
      3: 'Mer',
      4: 'Jeu',
      5: 'Ven',
      6: 'Sam',
      7: 'Dim',
    },
  },
  de: {
    openNow: 'Geöffnet',
    closedNow: 'Geschlossen',
    openUntil: 'Bis {time}',
    hours: 'Zeiten',
    navigate: 'Karte',
    call: 'Anrufen',
    introMore: 'Info',
    introLess: 'Weniger',
    weekTitle: 'Wochenzeiten',
    addressTitle: 'Adresse',
    weekdayLabels: {
      1: 'Mo',
      2: 'Di',
      3: 'Mi',
      4: 'Do',
      5: 'Fr',
      6: 'Sa',
      7: 'So',
    },
  },
};

function pickIntro(intro: CustomerStorefrontIntroI18n, lang: Language): string {
  if (lang === 'zh' && intro.zh.trim()) return intro.zh.trim();
  if (lang === 'en' && intro.en.trim()) return intro.en.trim();
  if (lang === 'pt' && intro.pt.trim()) return intro.pt.trim();
  return intro.pt.trim() || intro.en.trim() || intro.zh.trim();
}

function formatWindows(windows: CustomerStorefrontHoursWindow[]): string {
  return windows.map((w) => `${w.open}–${w.close}`).join(' · ');
}

type Props = {
  model: CustomerStorefrontBandModel;
  lang: Language;
};

/**
 * Full-bleed guest storefront decoration (cover + overlapping identity +
 * collapsed intro + compact tools). Scroll collapse is owned by the preview/shell.
 */
export function CustomerStorefrontBand({ model, lang }: Props) {
  const copy = COPY[lang] ?? COPY.zh;
  const introText = pickIntro(model.intro, lang);
  const [introOpen, setIntroOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailTitleId = useId();

  const statusLabel = model.openNow ? copy.openNow : copy.closedNow;
  const until =
    model.openUntilLabel && model.openNow
      ? copy.openUntil.replace('{time}', model.openUntilLabel)
      : null;

  return (
    <section className="relative w-full bg-brand-bg" aria-label={model.name}>
      <div
        className={`relative w-full overflow-hidden bg-brand-ink/90 ${CUSTOMER_STOREFRONT_COVER_HEIGHT_CLASS}`}
      >
        {model.coverUrl ? (
          <Image
            src={model.coverUrl}
            alt=""
            fill
            priority
            unoptimized={MENU_IMAGE_UNOPTIMIZED}
            className="object-cover"
            sizes="(max-width: 430px) 100vw, 430px"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45" />
      </div>

      <div className="relative z-[1] -mt-10 px-3 pb-2">
        <div className="rounded-2xl border border-brand-border/80 bg-brand-card px-3 pb-3 pt-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="relative -mt-8 h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-brand-card bg-brand-bg shadow-md">
              {model.logoUrl ? (
                <Image
                  src={model.logoUrl}
                  alt=""
                  fill
                  unoptimized={MENU_IMAGE_UNOPTIMIZED}
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-gold/15 font-heading text-xl text-brand-gold">
                  {model.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="font-heading text-lg leading-tight text-brand-ink truncate">
                {model.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    model.openNow
                      ? 'border-emerald-600/35 text-emerald-700 dark:text-emerald-400'
                      : 'border-brand-border text-brand-text-muted'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      model.openNow ? 'bg-emerald-600' : 'bg-brand-text-muted'
                    }`}
                    aria-hidden
                  />
                  {statusLabel}
                </span>
                {until ? (
                  <button
                    type="button"
                    onClick={() => setDetailOpen(true)}
                    className="text-[12px] text-brand-text-muted"
                  >
                    {until}
                    <span aria-hidden className="ml-0.5">
                      ›
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {introText ? (
            <div className="mt-3 border-t border-brand-border/60 pt-2.5">
              {introOpen ? (
                <p className="text-[13px] leading-relaxed text-brand-text">{introText}</p>
              ) : (
                <p className="truncate text-[13px] text-brand-text-muted">{introText}</p>
              )}
              <button
                type="button"
                onClick={() => setIntroOpen((v) => !v)}
                className="mt-1 text-[12px] font-medium text-brand-gold"
              >
                {introOpen ? copy.introLess : copy.introMore}
              </button>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-3 divide-x divide-brand-border/70 overflow-hidden rounded-xl bg-brand-bg/80 text-center">
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 px-1 py-2"
            >
              <span aria-hidden className="text-[13px] leading-none text-brand-gold">
                ◷
              </span>
              <span className="text-[11px] font-semibold text-brand-text">{copy.hours}</span>
            </button>
            <a
              href={model.mapsUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-brand-text"
              onClick={(e) => {
                if (!model.mapsUrl) e.preventDefault();
              }}
            >
              <span aria-hidden className="text-[13px] leading-none text-brand-gold">
                ⌖
              </span>
              <span className="text-[11px] font-semibold">{copy.navigate}</span>
            </a>
            <a
              href={model.phone ? `tel:${model.phone.replace(/\s+/g, '')}` : undefined}
              className="flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-brand-text"
              onClick={(e) => {
                if (!model.phone) e.preventDefault();
              }}
            >
              <span aria-hidden className="text-[13px] leading-none text-brand-gold">
                ☎
              </span>
              <span className="text-[11px] font-semibold">{copy.call}</span>
            </a>
          </div>
        </div>
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="close"
            onClick={() => setDetailOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailTitleId}
            className="relative z-[1] w-full max-w-mobile rounded-t-2xl bg-brand-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 id={detailTitleId} className="text-sm font-semibold text-brand-ink">
                {copy.weekTitle}
              </h3>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text-muted hover:bg-brand-bg"
                onClick={() => setDetailOpen(false)}
              >
                ×
              </button>
            </div>
            <ul className="space-y-2 text-[13px]">
              {model.weekHours.map((day) => (
                <li key={day.weekday} className="flex justify-between gap-3">
                  <span className="text-brand-text-muted">
                    {copy.weekdayLabels[day.weekday]}
                  </span>
                  <span className="text-right text-brand-text">
                    {day.windows.length ? formatWindows(day.windows) : '—'}
                  </span>
                </li>
              ))}
            </ul>
            {model.address ? (
              <div className="mt-4 border-t border-brand-border/70 pt-3">
                <p className="text-[11px] font-semibold text-brand-text-muted">
                  {copy.addressTitle}
                </p>
                <p className="mt-1 text-[13px] text-brand-text">{model.address}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
