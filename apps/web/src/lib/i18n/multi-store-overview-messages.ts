import type { Language } from '@/types';
import type { ListPaginationBarLabels } from '@/components/ui/ListPaginationBar';

/** Copy for the read-only multi-store overview page and its entries (plan §8.4). */
export type MultiStoreOverviewMessages = {
  /** Page title, nav item and picker / switcher entry label. */
  title: string;
  /** Picker-page entry card subtitle. */
  entryHint: string;
  /** `{date}` `{count}` */
  subtitle: string;
  refresh: string;
  refreshing: string;
  refreshFailed: string;
  /** `{time}` */
  updatedAt: string;
  scope: string;
  /** `{label}` = current scope. */
  scopeButton: string;
  scopeAll: string;
  scopeCity: string;
  scopePick: string;
  /** `{count}` */
  scopeAllLabel: string;
  scopeCityNone: string;
  /** `{count}` */
  scopePickLabel: string;
  /** `{count}` */
  scopeAllHint: string;
  /** `{count}` */
  storeCount: string;
  scopeSearchPlaceholder: string;
  searchPlaceholder: string;
  /** `{count}` */
  shownCount: string;
  colStore: string;
  colCollected: string;
  colUncollected: string;
  colToday: string;
  colDining: string;
  /** `{count}` */
  totalRow: string;
  /** `{count}` stores whose revenue could not be read (left out of the revenue totals). */
  totalRevenueMissing: string;
  empty: string;
  noStores: string;
  suspended: string;
  footnote: string;
  pagination: ListPaginationBarLabels;
};

const zh: MultiStoreOverviewMessages = {
  title: '多店概览',
  entryHint: '只读：按店看今天的营收、桌数和人数',
  subtitle: '{date} · 只列出你有「数据概览」权限的店（{count} 家），数字与各店首页一致',
  refresh: '刷新',
  refreshing: '刷新中…',
  refreshFailed: '刷新失败，请重试',
  updatedAt: '更新于 {time}',
  scope: '店铺范围',
  scopeButton: '店铺范围：{label}',
  scopeAll: '全部',
  scopeCity: '按城市',
  scopePick: '自选',
  scopeAllLabel: '全部店（{count}）',
  scopeCityNone: '按城市：未选',
  scopePickLabel: '自选 {count} 家',
  scopeAllHint: '统计你有概览权限的全部 {count} 家店。',
  storeCount: '{count} 家',
  scopeSearchPlaceholder: '搜索店名或城市',
  searchPlaceholder: '在结果里搜店名',
  shownCount: '显示 {count} 家',
  colStore: '店铺',
  colCollected: '已收',
  colUncollected: '未收',
  colToday: '今日 桌/人',
  colDining: '当前用餐 桌/人',
  totalRow: '合计（{count} 家，不含暂停）',
  totalRevenueMissing: '{count} 家营收取不到，未计入',
  empty: '当前范围没有店',
  noStores: '没有你可以查看数据概览的店。',
  suspended: '已暂停',
  footnote: '点列名排序；点店名进入那家店。合计只算当前筛选结果，不含暂停店。打开时加载一次，点「刷新」再取。',
  pagination: {
    pageInfo: '第 {page} / {totalPages} 页 · 共 {total} 家',
    pageSizeLabel: '每页',
    pageFirst: '第一页',
    pagePrev: '上一页',
    pageNext: '下一页',
    pageLast: '最后一页',
  },
};

const en: MultiStoreOverviewMessages = {
  title: 'Multi-store overview',
  entryHint: "Read-only: today's revenue, tables and guests per restaurant",
  subtitle: '{date} · Only restaurants where you can view the overview ({count}); figures match each home page',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  refreshFailed: 'Refresh failed, please retry',
  updatedAt: 'Updated {time}',
  scope: 'Restaurants',
  scopeButton: 'Restaurants: {label}',
  scopeAll: 'All',
  scopeCity: 'By city',
  scopePick: 'Pick',
  scopeAllLabel: 'All ({count})',
  scopeCityNone: 'By city: none selected',
  scopePickLabel: '{count} picked',
  scopeAllHint: 'All {count} restaurants you can view.',
  storeCount: '{count}',
  scopeSearchPlaceholder: 'Search name or city',
  searchPlaceholder: 'Search name in results',
  shownCount: '{count} shown',
  colStore: 'Restaurant',
  colCollected: 'Collected',
  colUncollected: 'Uncollected',
  colToday: 'Today tables/guests',
  colDining: 'Dining now tables/guests',
  totalRow: 'Total ({count}, excl. suspended)',
  totalRevenueMissing: '{count} without revenue data, not included',
  empty: 'No restaurant in this range',
  noStores: 'There is no restaurant whose overview you can view.',
  suspended: 'Suspended',
  footnote: 'Click a column to sort; click a name to open it. Totals cover the current filter only, excluding suspended. Loaded once on open; use Refresh to reload.',
  pagination: {
    pageInfo: 'Page {page} / {totalPages} · {total} total',
    pageSizeLabel: 'Per page',
    pageFirst: 'First page',
    pagePrev: 'Previous page',
    pageNext: 'Next page',
    pageLast: 'Last page',
  },
};

const pt: MultiStoreOverviewMessages = {
  title: 'Visão multi-loja',
  entryHint: 'Só leitura: receita, mesas e clientes de hoje por restaurante',
  subtitle: '{date} · Só restaurantes onde pode ver o painel ({count}); valores iguais ao início de cada um',
  refresh: 'Atualizar',
  refreshing: 'A atualizar…',
  refreshFailed: 'Falha ao atualizar, tente novamente',
  updatedAt: 'Atualizado {time}',
  scope: 'Restaurantes',
  scopeButton: 'Restaurantes: {label}',
  scopeAll: 'Todos',
  scopeCity: 'Por cidade',
  scopePick: 'Escolher',
  scopeAllLabel: 'Todos ({count})',
  scopeCityNone: 'Por cidade: nenhuma',
  scopePickLabel: '{count} escolhidos',
  scopeAllHint: 'Todos os {count} restaurantes que pode ver.',
  storeCount: '{count}',
  scopeSearchPlaceholder: 'Pesquisar nome ou cidade',
  searchPlaceholder: 'Pesquisar nome nos resultados',
  shownCount: '{count} visíveis',
  colStore: 'Restaurante',
  colCollected: 'Recebido',
  colUncollected: 'Por receber',
  colToday: 'Hoje mesas/clientes',
  colDining: 'Agora mesas/clientes',
  totalRow: 'Total ({count}, sem suspensos)',
  totalRevenueMissing: '{count} sem dados de receita, não incluídos',
  empty: 'Nenhum restaurante neste filtro',
  noStores: 'Não há restaurantes cujo painel possa ver.',
  suspended: 'Suspenso',
  footnote: 'Clique numa coluna para ordenar; clique num nome para entrar. Totais só do filtro atual, sem suspensos. Carrega ao abrir; use Atualizar para recarregar.',
  pagination: {
    pageInfo: 'Página {page} / {totalPages} · {total} no total',
    pageSizeLabel: 'Por página',
    pageFirst: 'Primeira página',
    pagePrev: 'Página anterior',
    pageNext: 'Página seguinte',
    pageLast: 'Última página',
  },
};

export const MULTI_STORE_OVERVIEW_MESSAGES: Record<Language, MultiStoreOverviewMessages> = {
  zh,
  en,
  pt,
  es: en,
  fr: en,
  de: en,
};
