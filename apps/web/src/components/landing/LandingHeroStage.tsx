'use client';

import { useLandingCopy } from '@/lib/landing/use-landing-copy';

const REVENUE_THIS = 'M0 74 L27 66 L54 70 L82 52 L109 58 L136 40 L163 46 L190 28 L218 36 L245 18 L272 24 L300 10';
const REVENUE_PREV = 'M0 80 L27 76 L54 74 L82 66 L109 68 L136 56 L163 58 L190 46 L218 50 L245 38 L272 40 L300 30';
/** Adult / child guest counts per bucket (demo). */
const GUEST_BARS: readonly (readonly [number, number])[] = [
  [22, 5], [28, 6], [24, 5], [32, 8], [26, 6], [34, 9], [30, 7], [36, 9], [28, 6], [34, 9], [31, 7], [38, 10],
];
const RANK_WIDTHS = ['100%', '75%', '65%', '56%'] as const;
const RANK_QTY = ['1,286', '964', '842', '715'] as const;
const DISH_TILES = [
  { emoji: '🍣', tile: 'from-[#fde5d4] to-[#f8c9a8]', price: '€ 6.50', qty: '2' },
  { emoji: '🥩', tile: 'from-[#ffe9b8] to-[#f2c36b]', price: '€ 12.80', qty: null },
  { emoji: '🥬', tile: 'from-[#d9eccf] to-[#a9d39a]', price: '€ 7.20', qty: null },
] as const;

const FLOAT_CLASS =
  'absolute z-[3] flex items-center gap-2.5 rounded-[14px] border border-brand-border/50 bg-brand-card px-3.5 py-2.5 shadow-[0_16px_36px_-12px_rgba(22,34,43,0.4)]';
const MINI_CARD_CLASS = 'min-w-0 rounded-lg border border-brand-border/50 bg-brand-card px-2.5 py-2';

/** Sole hero product proof: value-analytics dashboard + guest phone, drawn from demo data (not real customer numbers). */
export function LandingHeroStage() {
  const { stage } = useLandingCopy().hero;
  const a = stage.analytics;

  return (
    <div
      className="relative mx-auto h-[560px] w-full max-w-[640px] sm:h-[610px]"
      role="img"
      aria-label={stage.ariaLabel}
    >
      <div
        aria-hidden
        className="absolute inset-[6%_-4%_2%_6%] -rotate-[2.5deg] rounded-[44px] bg-gradient-to-br from-[#1f3e52] to-[#16222b] shadow-[0_40px_80px_-30px_rgba(22,34,43,0.55)]"
      />
      <div
        aria-hidden
        className="absolute -right-8 -top-5 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(185,138,69,0.55),transparent_68%)] blur-[10px]"
      />

      <div className={`${FLOAT_CLASS} right-8 top-1.5`}>
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-emerald-500/15">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600 shadow-[0_0_0_4px_rgba(47,125,91,0.18)]" />
        </span>
        <div>
          <p className="text-[12.5px] font-semibold leading-snug text-brand-text">{stage.offline.title}</p>
          <p className="text-[11px] text-brand-text-muted">{stage.offline.desc}</p>
        </div>
      </div>

      <div className="absolute right-[-6px] top-[62px] z-[1] w-[92%] rounded-2xl rounded-b-md bg-[#0f161b] p-[9px] pb-3 shadow-[0_2px_6px_rgba(22,34,43,0.05),0_30px_60px_-20px_rgba(22,34,43,0.28)] after:absolute after:-bottom-[11px] after:-left-[5%] after:-right-[5%] after:h-[11px] after:rounded-b-[14px] after:bg-gradient-to-b after:from-[#d8d2c6] after:to-[#aaa294] after:content-['']">
        <div className="grid min-h-[330px] grid-cols-[62px_1fr] overflow-hidden rounded-lg bg-brand-bg sm:grid-cols-[96px_1fr]">
          <div className="flex flex-col gap-1 bg-[#1f3e52] p-2 text-[9px] text-[#c4d0d8] sm:p-[14px_9px] sm:text-[10.5px]">
            <b className="mb-2 px-1 text-[11px] tracking-[0.14em] text-white">FARVOO</b>
            {a.nav.map((label, i) => (
              <span
                key={label}
                className={`truncate rounded-md px-2 py-1.5 ${i === 5 ? 'bg-[#b98a45] font-semibold text-white' : ''}`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-[9px] p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="whitespace-nowrap text-[12.5px] font-bold text-brand-text">{a.title}</h4>
              <div className="flex rounded-[7px] border border-brand-border/60 bg-brand-card p-0.5 text-[9px]">
                {a.ranges.map((label, i) => (
                  <i
                    key={label}
                    className={`rounded-[5px] px-[7px] py-0.5 not-italic ${i === 2 ? 'bg-[#16222b] text-white' : 'text-brand-text-muted'}`}
                  >
                    {label}
                  </i>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-[7px]">
              {[
                { label: a.kpiRevenue, value: '€38,420', delta: '↑12.4%', gold: true },
                { label: a.kpiGuests, value: '2,860', delta: '↑8.1%', gold: false },
                { label: a.kpiAvg, value: '€1,281', delta: null, gold: false },
              ].map((kpi) => (
                <div key={kpi.label} className={MINI_CARD_CLASS}>
                  <p className="truncate text-[8.5px] text-brand-text-muted">{kpi.label}</p>
                  <p className={`text-[14px] font-bold leading-snug ${kpi.gold ? 'text-brand-gold' : 'text-brand-text'}`}>
                    {kpi.value}
                  </p>
                  {kpi.delta ? (
                    <p className="truncate text-[8.5px] font-semibold text-emerald-600">
                      {a.kpiDelta} {kpi.delta}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[1.55fr_1fr] gap-2 max-sm:grid-cols-1">
              <div className={MINI_CARD_CLASS}>
                <p className="mb-1 flex justify-between gap-2 text-[9.5px] font-semibold text-brand-text">
                  <span className="truncate">{a.revenueTrend}</span>
                  <span className="flex shrink-0 gap-2 text-[8.5px] font-normal text-brand-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <i className="h-1.5 w-1.5 rounded-sm bg-brand-gold" />
                      {a.thisPeriod}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <i className="w-2 border-t-2 border-dashed border-[#7fa3ba]" />
                      {a.lastPeriod}
                    </span>
                  </span>
                </p>
                <svg viewBox="0 0 300 96" preserveAspectRatio="none" className="block h-auto w-full text-brand-gold" aria-hidden>
                  <defs>
                    <linearGradient id="landing-stage-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="currentColor" stopOpacity="0.38" />
                      <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 24H300M0 48H300M0 72H300" stroke="currentColor" strokeOpacity="0.12" fill="none" />
                  <path d={`${REVENUE_THIS} V96 H0Z`} fill="url(#landing-stage-area)" />
                  <path d={REVENUE_PREV} fill="none" stroke="#7fa3ba" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  <path d={REVENUE_THIS} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <circle cx="300" cy="10" r="3.5" fill="currentColor" />
                </svg>
              </div>
              <div className={`${MINI_CARD_CLASS} max-sm:hidden`}>
                <p className="mb-1 flex justify-between gap-1 text-[9.5px] font-semibold text-brand-text">
                  <span className="truncate">{a.ranking}</span>
                </p>
                <div className="grid gap-[5px] text-[9.5px]">
                  {a.rankNames.map((name, i) => (
                    <div key={name} className="grid grid-cols-[12px_1fr_auto] items-center gap-[5px]">
                      <b className="font-bold text-brand-gold">{i + 1}</b>
                      <span className="truncate text-brand-text">{name}</span>
                      <i className="not-italic tabular-nums text-brand-text-muted">{RANK_QTY[i]}</i>
                      <u
                        aria-hidden
                        className="col-span-2 col-start-2 -mt-0.5 block h-[3px] rounded-sm bg-gradient-to-r from-[#b98a45] to-brand-gold no-underline"
                        style={{ width: RANK_WIDTHS[i] }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={MINI_CARD_CLASS}>
              <p className="mb-1 flex justify-between gap-2 text-[9.5px] font-semibold text-brand-text">
                <span>{a.guestTrend}</span>
                <span className="flex gap-2 text-[8.5px] font-normal text-brand-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <i className="h-1.5 w-1.5 rounded-sm bg-[#b98a45]" />
                    {a.adults}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <i className="h-1.5 w-1.5 rounded-sm bg-[#7fa3ba]" />
                    {a.children}
                  </span>
                </span>
              </p>
              <svg viewBox="0 0 300 40" preserveAspectRatio="none" className="block h-auto w-full" aria-hidden>
                {GUEST_BARS.map(([adult, child], i) => (
                  <g key={i}>
                    <rect x={4 + i * 24} y={40 - adult} width="14" height={adult} rx="2" fill="#b98a45" />
                    <rect x={4 + i * 24} y={40 - adult} width="14" height={child} rx="2" fill="#7fa3ba" />
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-[2] w-[196px] rounded-[38px] bg-[#0f161b] p-2 shadow-[0_2px_6px_rgba(22,34,43,0.05),0_30px_60px_-20px_rgba(22,34,43,0.28)] sm:w-[232px]">
        <div className="flex h-[420px] flex-col overflow-hidden rounded-[31px] bg-brand-bg sm:h-[488px]">
          <div className="bg-brand-card px-3.5 pb-2 pt-[18px]">
            <p className="text-[9.5px] text-brand-text-muted">{stage.phone.table}</p>
            <p className="text-[15px] font-bold text-brand-text">{stage.phone.restaurant}</p>
          </div>
          <div className="flex gap-1.5 overflow-hidden border-b border-brand-border/50 bg-brand-card px-3 pb-1 pt-2">
            {stage.phone.chips.map((chip, i) => (
              <span
                key={chip}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10.5px] ${i === 0 ? 'border-brand-gold bg-brand-gold text-brand-on-gold' : 'border-brand-border/60 bg-brand-bg'}`}
              >
                {chip}
              </span>
            ))}
          </div>
          {stage.phone.dishes.map((dish, i) => {
            const tile = DISH_TILES[i]!;
            return (
              <div
                key={dish.name}
                className="relative mx-[11px] mt-[9px] grid grid-cols-[54px_1fr] gap-2.5 rounded-[14px] border border-brand-border/50 bg-brand-card p-2 sm:grid-cols-[66px_1fr]"
              >
                <div className={`grid h-[54px] w-[54px] place-items-center rounded-[11px] bg-gradient-to-br text-[26px] sm:h-[66px] sm:w-[66px] sm:text-[32px] ${tile.tile}`}>
                  {tile.emoji}
                </div>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-snug text-brand-text">{dish.name}</p>
                  <p className="mt-px text-[9.5px] font-medium text-brand-gold">{dish.flavor}</p>
                  <p className="mt-1 text-[13px] font-bold text-brand-text">{tile.price}</p>
                </div>
                <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-brand-gold text-[17px] font-bold leading-none text-brand-on-gold shadow-[0_4px_10px_-3px_rgba(139,101,48,0.7)]">
                  {tile.qty ?? '+'}
                </span>
              </div>
            );
          })}
          <div className="mt-auto flex items-center gap-2.5 border-t border-brand-border/50 bg-brand-card px-3 pb-3.5 pt-2.5">
            <span className="relative grid h-[34px] w-[34px] place-items-center rounded-full border border-brand-border/60 bg-brand-bg text-[15px]">
              🛍
              <em className="absolute -right-[3px] -top-[3px] grid h-[15px] min-w-[15px] place-items-center rounded-full bg-brand-gold text-[9px] font-bold not-italic text-brand-on-gold">
                2
              </em>
            </span>
            <span className="text-[15px] font-bold text-brand-text">€ 13.00</span>
            <span className="ml-auto rounded-[10px] bg-brand-gold px-[15px] py-[9px] text-[11.5px] font-semibold text-brand-on-gold">
              {stage.phone.submit}
            </span>
          </div>
        </div>
      </div>

      <div className={`${FLOAT_CLASS} bottom-1.5 left-[226px] hidden min-w-[180px] flex-col items-stretch gap-0.5 sm:flex sm:min-w-[206px]`}>
        <div className="flex justify-between gap-3 text-[10.5px] text-brand-text-muted">
          <span>{stage.revenueLabel}</span>
          <span>{stage.revenueSplit}</span>
        </div>
        <p className="text-xl font-bold leading-tight text-brand-gold">
          €1,245<span className="ml-1.5 text-[13px] font-semibold text-brand-gold/45">+ €186</span>
        </p>
      </div>

      <div className={`${FLOAT_CLASS} -right-2 bottom-[112px] hidden sm:flex`}>
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-brand-gold/10 text-brand-gold">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z" />
          </svg>
        </span>
        <div>
          <p className="text-[12.5px] font-semibold leading-snug text-brand-text">{stage.print.title}</p>
          <p className="text-[11px] text-brand-text-muted">{stage.print.desc}</p>
        </div>
      </div>

      <span className="absolute -bottom-[22px] right-1.5 text-[11px] text-brand-text-muted">{stage.demoNote}</span>
    </div>
  );
}
