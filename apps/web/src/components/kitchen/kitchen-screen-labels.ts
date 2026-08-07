import type { UILanguage } from '@/lib/i18n';

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
    noLines: string;
    statusPending: string;
    statusCooking: string;
    statusReady: string;
    statusDone: string;
    qtyBadge: string;
    tablesLabel: string;
    expandDish: string;
    collapseDish: string;
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
    viewByDish: '按菜统计',
    prep: '备餐',
    prepBusy: '备餐中…',
    maximize: '最大化',
    restore: '复原',
    selectLines: '勾选后点击备餐',
    noLines: '暂无待备餐菜品',
    statusPending: '已下单',
    statusCooking: '备餐中',
    statusReady: '已出餐',
    statusDone: '已上桌',
    qtyBadge: '共 {n}',
    tablesLabel: '桌：{tables}',
    expandDish: '展开',
    collapseDish: '收起',
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
    noLines: 'No dishes waiting',
    statusPending: 'Ordered',
    statusCooking: 'Prepping',
    statusReady: 'Ready',
    statusDone: 'Served',
    qtyBadge: '×{n}',
    tablesLabel: 'Tables: {tables}',
    expandDish: 'Expand',
    collapseDish: 'Collapse',
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
    noLines: 'Sem pratos a preparar',
    statusPending: 'Pedido',
    statusCooking: 'Em preparo',
    statusReady: 'Pronto',
    statusDone: 'Servido',
    qtyBadge: '×{n}',
    tablesLabel: 'Mesas: {tables}',
    expandDish: 'Expandir',
    collapseDish: 'Recolher',
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
    noLines: 'Sin platos pendientes',
    statusPending: 'Pedido',
    statusCooking: 'En preparacion',
    statusReady: 'Listo',
    statusDone: 'Servido',
    qtyBadge: '×{n}',
    tablesLabel: 'Mesas: {tables}',
    expandDish: 'Expandir',
    collapseDish: 'Cerrar',
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
    noLines: 'Aucun plat en attente',
    statusPending: 'Commande',
    statusCooking: 'En prep.',
    statusReady: 'Pret',
    statusDone: 'Servi',
    qtyBadge: '×{n}',
    tablesLabel: 'Tables : {tables}',
    expandDish: 'Ouvrir',
    collapseDish: 'Fermer',
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
    noLines: 'Keine offenen Gerichte',
    statusPending: 'Bestellt',
    statusCooking: 'In Arbeit',
    statusReady: 'Fertig',
    statusDone: 'Serviert',
    qtyBadge: '×{n}',
    tablesLabel: 'Tische: {tables}',
    expandDish: 'Aufklappen',
    collapseDish: 'Zuklappen',
    prepFailed: 'Vorbereitung fehlgeschlagen',
    conflict: 'Board aktualisiert — erneut versuchen',
  },
};
