import type { UILanguage } from '@/lib/i18n';
import { KITCHEN_ITEM_STATUS_LABEL } from '@/lib/kitchen-progress-display';

/** Kitchen-screen UI copy (zh/en primary; others fall back to en). */
export const KITCHEN_SCREEN_TEXT: Record<
  UILanguage,
  {
    screensTitle: string;
    screensEmpty: string;
    screensEmptyHint: string;
    openScreen: string;
    backToScreens: string;
    viewByTable: string;
    viewByDish: string;
    prep: string;
    prepBusy: string;
    maximize: string;
    restore: string;
    selectLines: string;
    selectAll: string;
    deselectAll: string;
    noLines: string;
    statusPending: string;
    statusCooking: string;
    statusReady: string;
    statusDone: string;
    /** By-dish L1: workbench portion total for this dish. */
    portionBadge: string;
    /** By-dish L1: distinct table count (never line/qty count). */
    tablesCountBadge: string;
    tablesLabel: string;
    waitMinutes: string;
    expandGroup: string;
    collapseGroup: string;
    readyRailShow: string;
    readyRailHide: string;
    readyRailEmpty: string;
    prepSuccess: string;
    prepFailed: string;
    conflict: string;
  }
> = {
  zh: {
    screensTitle: '后厨大屏',
    screensEmpty: '暂无大屏',
    screensEmptyHint: '请店主在设置中配置后厨大屏与档口。',
    openScreen: '打开',
    backToScreens: '返回大屏列表',
    viewByTable: '按桌',
    viewByDish: '按菜',
    prep: '备餐',
    prepBusy: '备餐中…',
    maximize: '最大化',
    restore: '复原',
    selectLines: '勾选后点击备餐',
    selectAll: '全选',
    deselectAll: '取消全选',
    noLines: '暂无待备餐菜品',
    statusPending: KITCHEN_ITEM_STATUS_LABEL.zh.pending,
    statusCooking: KITCHEN_ITEM_STATUS_LABEL.zh.cooking,
    statusReady: KITCHEN_ITEM_STATUS_LABEL.zh.ready,
    statusDone: KITCHEN_ITEM_STATUS_LABEL.zh.done,
    portionBadge: '共 {n} 份',
    tablesCountBadge: '共 {n} 桌',
    tablesLabel: '桌：{tables}',
    waitMinutes: '等 {n} 分',
    expandGroup: '展开',
    collapseGroup: '收起',
    readyRailShow: '已出餐 · {n}',
    readyRailHide: '收起已出餐',
    readyRailEmpty: '暂无已出餐',
    prepSuccess: '已备餐',
    prepFailed: '备餐失败，请重试',
    conflict: '数据已更新，请重试',
  },
  en: {
    screensTitle: 'Kitchen screens',
    screensEmpty: 'No screens configured',
    screensEmptyHint: 'Ask the owner to configure kitchen screens and stations in settings.',
    openScreen: 'Open',
    backToScreens: 'Back to screens',
    viewByTable: 'By table',
    viewByDish: 'By dish',
    prep: 'Prep',
    prepBusy: 'Prepping…',
    maximize: 'Maximize',
    restore: 'Restore',
    selectLines: 'Select lines, then prep',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    noLines: 'No dishes waiting',
    statusPending: KITCHEN_ITEM_STATUS_LABEL.en.pending,
    statusCooking: KITCHEN_ITEM_STATUS_LABEL.en.cooking,
    statusReady: KITCHEN_ITEM_STATUS_LABEL.en.ready,
    statusDone: KITCHEN_ITEM_STATUS_LABEL.en.done,
    portionBadge: '{n} pcs',
    tablesCountBadge: '{n} tables',
    tablesLabel: 'Tables: {tables}',
    waitMinutes: '{n}m wait',
    expandGroup: 'Expand',
    collapseGroup: 'Collapse',
    readyRailShow: 'Ready · {n}',
    readyRailHide: 'Hide ready',
    readyRailEmpty: 'No ready dishes',
    prepSuccess: 'Prepped',
    prepFailed: 'Prep failed — try again',
    conflict: 'Board updated — please retry',
  },
  pt: {
    screensTitle: 'Ecras de cozinha',
    screensEmpty: 'Sem ecras configurados',
    screensEmptyHint: 'Peca ao dono para configurar ecras e estacoes nas definicoes.',
    openScreen: 'Abrir',
    backToScreens: 'Voltar aos ecras',
    viewByTable: 'Por mesa',
    viewByDish: 'Por prato',
    prep: 'Preparar',
    prepBusy: 'A preparar…',
    maximize: 'Maximizar',
    restore: 'Restaurar',
    selectLines: 'Selecione e prepare',
    selectAll: 'Selecionar tudo',
    deselectAll: 'Desmarcar',
    noLines: 'Sem pratos a preparar',
    statusPending: KITCHEN_ITEM_STATUS_LABEL.pt.pending,
    statusCooking: KITCHEN_ITEM_STATUS_LABEL.pt.cooking,
    statusReady: KITCHEN_ITEM_STATUS_LABEL.pt.ready,
    statusDone: KITCHEN_ITEM_STATUS_LABEL.pt.done,
    portionBadge: '{n} un.',
    tablesCountBadge: '{n} mesas',
    tablesLabel: 'Mesas: {tables}',
    waitMinutes: '{n} min',
    expandGroup: 'Expandir',
    collapseGroup: 'Recolher',
    readyRailShow: 'Pronto · {n}',
    readyRailHide: 'Ocultar prontos',
    readyRailEmpty: 'Sem pratos prontos',
    prepSuccess: 'Preparado',
    prepFailed: 'Falha ao preparar',
    conflict: 'Quadro atualizado — tente de novo',
  },
  es: {
    screensTitle: 'Pantallas de cocina',
    screensEmpty: 'Sin pantallas',
    screensEmptyHint: 'Pida al dueno configurar pantallas y estaciones.',
    openScreen: 'Abrir',
    backToScreens: 'Volver',
    viewByTable: 'Por mesa',
    viewByDish: 'Por plato',
    prep: 'Preparar',
    prepBusy: 'Preparando…',
    maximize: 'Maximizar',
    restore: 'Restaurar',
    selectLines: 'Seleccione y prepare',
    selectAll: 'Seleccionar todo',
    deselectAll: 'Deseleccionar',
    noLines: 'Sin platos pendientes',
    statusPending: KITCHEN_ITEM_STATUS_LABEL.es.pending,
    statusCooking: KITCHEN_ITEM_STATUS_LABEL.es.cooking,
    statusReady: KITCHEN_ITEM_STATUS_LABEL.es.ready,
    statusDone: KITCHEN_ITEM_STATUS_LABEL.es.done,
    portionBadge: '{n} uds',
    tablesCountBadge: '{n} mesas',
    tablesLabel: 'Mesas: {tables}',
    waitMinutes: '{n} min',
    expandGroup: 'Expandir',
    collapseGroup: 'Cerrar',
    readyRailShow: 'Listo · {n}',
    readyRailHide: 'Ocultar listos',
    readyRailEmpty: 'Sin platos listos',
    prepSuccess: 'Preparado',
    prepFailed: 'Error al preparar',
    conflict: 'Tablero actualizado — reintente',
  },
  fr: {
    screensTitle: 'Ecrans cuisine',
    screensEmpty: 'Aucun ecran',
    screensEmptyHint: 'Demandez au gerant de configurer les ecrans.',
    openScreen: 'Ouvrir',
    backToScreens: 'Retour',
    viewByTable: 'Par table',
    viewByDish: 'Par plat',
    prep: 'Preparer',
    prepBusy: 'Preparation…',
    maximize: 'Agrandir',
    restore: 'Restaurer',
    selectLines: 'Selectionnez puis preparez',
    selectAll: 'Tout select.',
    deselectAll: 'Tout deselect.',
    noLines: 'Aucun plat en attente',
    statusPending: KITCHEN_ITEM_STATUS_LABEL.fr.pending,
    statusCooking: KITCHEN_ITEM_STATUS_LABEL.fr.cooking,
    statusReady: KITCHEN_ITEM_STATUS_LABEL.fr.ready,
    statusDone: KITCHEN_ITEM_STATUS_LABEL.fr.done,
    portionBadge: '{n} pcs',
    tablesCountBadge: '{n} tables',
    tablesLabel: 'Tables : {tables}',
    waitMinutes: '{n} min',
    expandGroup: 'Ouvrir',
    collapseGroup: 'Fermer',
    readyRailShow: 'Pret · {n}',
    readyRailHide: 'Masquer prets',
    readyRailEmpty: 'Aucun plat pret',
    prepSuccess: 'Prepare',
    prepFailed: 'Echec preparation',
    conflict: 'Tableau mis a jour — reessayez',
  },
  de: {
    screensTitle: 'Kuchenschirme',
    screensEmpty: 'Keine Schirme',
    screensEmptyHint: 'Bitten Sie den Inhaber, Schirme zu konfigurieren.',
    openScreen: 'Offnen',
    backToScreens: 'Zuruck',
    viewByTable: 'Nach Tisch',
    viewByDish: 'Nach Gericht',
    prep: 'Vorbereiten',
    prepBusy: 'Laeuft…',
    maximize: 'Maximieren',
    restore: 'Wiederherstellen',
    selectLines: 'Zeilen waehlen, dann vorbereiten',
    selectAll: 'Alles',
    deselectAll: 'Nichts',
    noLines: 'Keine offenen Gerichte',
    statusPending: KITCHEN_ITEM_STATUS_LABEL.de.pending,
    statusCooking: KITCHEN_ITEM_STATUS_LABEL.de.cooking,
    statusReady: KITCHEN_ITEM_STATUS_LABEL.de.ready,
    statusDone: KITCHEN_ITEM_STATUS_LABEL.de.done,
    portionBadge: '{n} Stk',
    tablesCountBadge: '{n} Tische',
    tablesLabel: 'Tische: {tables}',
    waitMinutes: '{n} Min',
    expandGroup: 'Aufklappen',
    collapseGroup: 'Zuklappen',
    readyRailShow: 'Fertig · {n}',
    readyRailHide: 'Fertige ausblenden',
    readyRailEmpty: 'Keine fertigen Gerichte',
    prepSuccess: 'Vorbereitet',
    prepFailed: 'Vorbereitung fehlgeschlagen',
    conflict: 'Board aktualisiert — erneut versuchen',
  },
};
