import type { LandingLanguage, LandingPreviewCopy } from '@/lib/landing/types';

const LANDING_PREVIEW_COPY: Record<LandingLanguage, LandingPreviewCopy> = {
  zh: {
    chrome: {
      banner: '界面预览 · MesaGo 演示数据',
    },
    shared: {
      tableLabel: '桌 {name}',
      restaurantName: 'MesaGo 演示',
    },
    waiterOpen: {
      roleHint: '服务员 · 开台确认',
      diningStatus: '用餐中',
      buffetName: '午市自助',
      adultsLabel: '成人数',
      childrenLabel: '儿童数',
      adultPriceLabel: '成人单价',
      childPriceLabel: '儿童单价',
      estimatedTotalLabel: '预计合计',
      confirmOpen: '确认开台',
    },
    menu: {
      subtitle: '扫码点酒水 · 三语菜单 · 出品档口：{outlet}',
      outletBar: '吧台',
      categories: {
        drinks: '饮料',
        'fruit-wine': '水果酒',
      },
      cartSummary: '购物车 {count} 项饮料',
      submitOrder: '提交订单',
    },
    bar: {
      title: '吧台看板',
      subtitle: '酒水订单',
      status: {
        pending: '待出单',
        preparing: '制作中',
      },
      doneBadge: '已出',
      lineQty: '{name} ×{qty}',
    },
    bill: {
      frameSuffix: ' · 结账',
      title: '分单结账',
      subtitle: '自助餐人头费与酒水消费分开显示',
      buffetFee: '自助餐人头费',
      drinksTotal: '酒水消费',
      grandTotal: '合计',
      splitModeTitle: '分单方式',
      splitModes: ['均摊', '按菜分配', '自定义'],
      perGuestSummary: '{guests} 位消费者 · 人均 {avg}',
      confirmPayment: '确认收款',
    },
    dashboard: {
      title: '数据概览',
      todayOrders: '今日订单',
      todayRevenue: '今日营业额',
      topDrinksTitle: '今日热销酒水',
      drinkColumn: '酒水',
      qtyColumn: '销量',
    },
  },
  en: {
    chrome: {
      banner: 'UI preview · MesaGo demo data',
    },
    shared: {
      tableLabel: 'Table {name}',
      restaurantName: 'MesaGo Demo',
    },
    waiterOpen: {
      roleHint: 'Waiter · Open table',
      diningStatus: 'Seated',
      buffetName: 'Lunch buffet',
      adultsLabel: 'Adults',
      childrenLabel: 'Children',
      adultPriceLabel: 'Adult price',
      childPriceLabel: 'Child price',
      estimatedTotalLabel: 'Estimated total',
      confirmOpen: 'Confirm open',
    },
    menu: {
      subtitle: 'Scan to order drinks · Trilingual menu · Station: {outlet}',
      outletBar: 'Bar',
      categories: {
        drinks: 'Drinks',
        'fruit-wine': 'Fruit wine',
      },
      cartSummary: 'Cart · {count} drinks',
      submitOrder: 'Submit order',
    },
    bar: {
      title: 'Bar board',
      subtitle: 'Drink orders',
      status: {
        pending: 'Pending',
        preparing: 'Preparing',
      },
      doneBadge: 'Done',
      lineQty: '{name} ×{qty}',
    },
    bill: {
      frameSuffix: ' · Checkout',
      title: 'Split bill',
      subtitle: 'Buffet cover and drinks shown separately',
      buffetFee: 'Buffet cover',
      drinksTotal: 'Drinks',
      grandTotal: 'Total',
      splitModeTitle: 'Split mode',
      splitModes: ['Even', 'By item', 'Custom'],
      perGuestSummary: '{guests} guests · {avg} each',
      confirmPayment: 'Confirm payment',
    },
    dashboard: {
      title: 'Overview',
      todayOrders: 'Orders today',
      todayRevenue: 'Revenue today',
      topDrinksTitle: 'Top drinks today',
      drinkColumn: 'Drink',
      qtyColumn: 'Qty',
    },
  },
  pt: {
    chrome: {
      banner: 'Pre-visualizacao · Dados demo MesaGo',
    },
    shared: {
      tableLabel: 'Mesa {name}',
      restaurantName: 'MesaGo Demo',
    },
    waiterOpen: {
      roleHint: 'Empregado · Abrir mesa',
      diningStatus: 'Em refeicao',
      buffetName: 'Buffet almoço',
      adultsLabel: 'Adultos',
      childrenLabel: 'Criancas',
      adultPriceLabel: 'Preco adulto',
      childPriceLabel: 'Preco crianca',
      estimatedTotalLabel: 'Total estimado',
      confirmOpen: 'Confirmar abertura',
    },
    menu: {
      subtitle: 'Pedir bebidas por QR · Menu trilingue · Estacao: {outlet}',
      outletBar: 'Balcao',
      categories: {
        drinks: 'Bebidas',
        'fruit-wine': 'Vinho de fruta',
      },
      cartSummary: 'Carrinho · {count} bebidas',
      submitOrder: 'Enviar pedido',
    },
    bar: {
      title: 'Quadro do balcao',
      subtitle: 'Pedidos de bebidas',
      status: {
        pending: 'Pendente',
        preparing: 'Em preparacao',
      },
      doneBadge: 'Pronto',
      lineQty: '{name} ×{qty}',
    },
    bill: {
      frameSuffix: ' · Conta',
      title: 'Dividir conta',
      subtitle: 'Base buffet e bebidas apresentadas em separado',
      buffetFee: 'Base buffet',
      drinksTotal: 'Bebidas',
      grandTotal: 'Total',
      splitModeTitle: 'Modo de divisao',
      splitModes: ['Igual', 'Por item', 'Personalizado'],
      perGuestSummary: '{guests} pessoas · {avg} por pessoa',
      confirmPayment: 'Confirmar pagamento',
    },
    dashboard: {
      title: 'Visao geral',
      todayOrders: 'Pedidos hoje',
      todayRevenue: 'Faturamento hoje',
      topDrinksTitle: 'Bebidas mais vendidas',
      drinkColumn: 'Bebida',
      qtyColumn: 'Qtd',
    },
  },
};

export function getLandingPreviewCopy(lang: LandingLanguage): LandingPreviewCopy {
  return LANDING_PREVIEW_COPY[lang];
}

/** Replace `{key}` placeholders in preview copy templates. */
export function formatPreviewCopy(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`,
  );
}
