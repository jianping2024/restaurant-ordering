'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { ProductTopBarRestaurantName } from '@/components/ui/ProductTopBarRestaurantName';
import { StaffAccountIcon } from '@/components/auth/auth-icons';
import {
  fitStaffTopBarRestaurantName,
  type StaffTopBarRestaurantNameFit,
} from '@/lib/staff-topbar-restaurant-name';
import {
  STAFF_TOP_BAR_TRAILING_TEXT_MAX_CLASS,
  staffTopBarChrome,
} from '@/lib/waiter-staff-sticky-chrome';

type CaseRow = {
  id: string;
  title: string;
  name: string;
  note: string;
};

const CASES: CaseRow[] = [
  {
    id: 'short-zh',
    title: '短中文 · 通常完整',
    name: '白云',
    note: '短名在多数宽度下应 mode=full',
  },
  {
    id: 'washoku',
    title: '两词英文 · 先丢右边词',
    name: 'Washoku Sushi',
    note: '变窄：Washoku Sushi → Washoku → Wash…',
  },
  {
    id: 'three-en',
    title: '三词英文 · 从右逐个减',
    name: 'Washoku Sushi Bar',
    note: '先丢 Bar，再丢 Sushi，再截 Washoku',
  },
  {
    id: 'long-zh',
    title: '长中文 · 无空格当一词',
    name: '白云自助火锅店总店',
    note: '没有空格 → 直接按字省略加 …',
  },
  {
    id: 'mixed',
    title: '多词店名',
    name: 'Pirata Lisboa Centro',
    note: '从右减词：… → Pirata Lisboa → Pirata → Pir…',
  },
  {
    id: 'one-long-en',
    title: '超长单词语',
    name: 'Supercalifragilistic',
    note: '只剩一词 → 部分字母 + …',
  },
];

const WIDTH_PRESETS = [
  { label: '320 · 显示缩放', width: 320 },
  { label: '375 · SE', width: 375 },
  { label: '393 · iPhone 16', width: 393 },
  { label: '402 · iPhone 17', width: 402 },
] as const;

const ZOOM_PRESETS = [
  { label: '100%', scale: 1 },
  { label: '125%', scale: 1.25 },
  { label: '150% · 接近放大文字', scale: 1.5 },
] as const;

const MATRIX_NAME_BUDGETS = [160, 120, 80, 48] as const;

function modeLabel(mode: StaffTopBarRestaurantNameFit['mode']): string {
  if (mode === 'full') return '完整';
  if (mode === 'drop-words') return '从右减词';
  return '单词语省略';
}

function modeClass(mode: StaffTopBarRestaurantNameFit['mode']): string {
  if (mode === 'full') return 'bg-emerald-500/15 text-emerald-800';
  if (mode === 'drop-words') return 'bg-amber-500/20 text-amber-900';
  return 'bg-rose-500/15 text-rose-800';
}

function MockTopBar({
  name,
  fontScale,
  shellWidth,
}: {
  name: string;
  fontScale: number;
  shellWidth: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-sm"
      style={{ width: shellWidth, maxWidth: '100%' }}
    >
      <div
        className={`${staffTopBarChrome.rowClassName} !max-w-none`}
        style={{ fontSize: `${fontScale * 100}%` }}
      >
        <div className={staffTopBarChrome.brandClassName}>
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-2">
            <span className="shrink-0 leading-none">
              <ProductLogo size="sm" tone="ink" />
            </span>
            <ProductTopBarRestaurantName name={name} />
          </div>
        </div>
        <div className={staffTopBarChrome.rightClusterClassName}>
          <span className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center px-2 text-lg leading-none text-brand-text-muted">
            ☰
          </span>
          <span
            className={`inline-flex h-11 ${STAFF_TOP_BAR_TRAILING_TEXT_MAX_CLASS} shrink-0 flex-nowrap items-center gap-1 overflow-hidden whitespace-nowrap px-2 text-sm font-medium text-brand-text-muted`}
          >
            <StaffAccountIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">后台管理员</span>
          </span>
        </div>
      </div>
      <div className="border-t border-brand-border/60 bg-brand-bg/60 px-3 py-2 text-xs text-brand-text-muted">
        正式节点：`ProductTopBarRestaurantName` + `fitStaffTopBarRestaurantName`
      </div>
    </div>
  );
}

function CaseMatrix({ fontScale }: { fontScale: number }) {
  const probeRef = useRef<HTMLSpanElement>(null);
  const [rows, setRows] = useState<
    Array<CaseRow & { cells: Array<{ budget: number; fit: StaffTopBarRestaurantNameFit }> }>
  >(() =>
    CASES.map((c) => ({
      ...c,
      cells: MATRIX_NAME_BUDGETS.map((budget) => ({
        budget,
        fit: fitStaffTopBarRestaurantName(c.name, budget, (t) => t.length * 8),
      })),
    })),
  );

  useLayoutEffect(() => {
    const measure = (text: string) => {
      const el = probeRef.current;
      if (!el) return text.length * 8 * fontScale;
      el.textContent = text;
      return el.getBoundingClientRect().width;
    };
    setRows(
      CASES.map((c) => ({
        ...c,
        cells: MATRIX_NAME_BUDGETS.map((budget) => ({
          budget,
          fit: fitStaffTopBarRestaurantName(c.name, budget, measure),
        })),
      })),
    );
  }, [fontScale]);

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-card">
      <span
        ref={probeRef}
        aria-hidden
        className={`pointer-events-none absolute -left-[9999px] top-0 ${staffTopBarChrome.restaurantNameMeasureClassName}`}
        style={{ fontSize: `${fontScale * 100}%` }}
      />
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-brand-border bg-brand-bg/70 text-xs text-brand-text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">场景</th>
            <th className="px-3 py-2 font-medium">原名</th>
            {MATRIX_NAME_BUDGETS.map((b) => (
              <th key={b} className="px-3 py-2 font-medium">
                名宽 {b}px
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-brand-border/50 align-top">
              <td className="px-3 py-3">
                <div className="font-medium text-brand-text">{row.title}</div>
                <div className="mt-0.5 text-xs text-brand-text-muted">{row.note}</div>
              </td>
              <td
                className={`px-3 py-3 ${staffTopBarChrome.restaurantNameMeasureClassName}`}
              >
                {row.name}
              </td>
              {row.cells.map((cell) => (
                <td key={cell.budget} className="px-3 py-3">
                  <div className={staffTopBarChrome.restaurantNameMeasureClassName}>
                    {cell.fit.display || '—'}
                  </div>
                  <div
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${modeClass(cell.fit.mode)}`}
                  >
                    {modeLabel(cell.fit.mode)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StaffTopbarNameYieldPreview() {
  const [name, setName] = useState('Washoku Sushi');
  const [shellWidth, setShellWidth] = useState(320);
  const [fontScale, setFontScale] = useState(1.25);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-text-muted">
            Preview · 职员顶栏店名让宽
          </p>
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
            店名不够宽时怎么收
          </h1>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-brand-text-muted sm:text-base">
            <li>多单词：从右边开始丢掉整词，直到左边剩下的短语能放下。</li>
            <li>只剩一个单词仍放不下：显示该词的前缀 + …</li>
            <li>没有空格的中文店名：整段当一个词，直接走第 2 步。</li>
          </ol>
        </header>

        <section className="space-y-4 rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">实时顶栏（正式组件）</h2>
          <label className="block space-y-1 text-sm">
            <span className="text-brand-text-muted">餐厅名</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-base"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {WIDTH_PRESETS.map((p) => (
              <button
                key={p.width}
                type="button"
                onClick={() => setShellWidth(p.width)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  shellWidth === p.width
                    ? 'bg-brand-ink text-brand-on-ink'
                    : 'bg-brand-bg text-brand-text-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-brand-text-muted">
              壳宽 {shellWidth}px（模拟手机内容宽）
            </span>
            <input
              type="range"
              min={280}
              max={430}
              value={shellWidth}
              onChange={(e) => setShellWidth(Number(e.target.value))}
              className="w-full"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {ZOOM_PRESETS.map((p) => (
              <button
                key={p.scale}
                type="button"
                onClick={() => setFontScale(p.scale)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  fontScale === p.scale
                    ? 'bg-brand-ink text-brand-on-ink'
                    : 'bg-brand-bg text-brand-text-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-brand-text-muted">
              文字缩放 {Math.round(fontScale * 100)}%（模拟系统放大文字）
            </span>
            <input
              type="range"
              min={100}
              max={160}
              value={Math.round(fontScale * 100)}
              onChange={(e) => setFontScale(Number(e.target.value) / 100)}
              className="w-full"
            />
          </label>

          <div className="flex justify-center py-4">
            <MockTopBar name={name} fontScale={fontScale} shellWidth={shellWidth} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">固定「店名可用宽」对照表</h2>
          <CaseMatrix fontScale={fontScale} />
        </section>
      </div>
    </div>
  );
}
