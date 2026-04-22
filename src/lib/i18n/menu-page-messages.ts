import type { Language } from '@/types';

export const MENU_PAGE_MESSAGES: Record<Language, {
  table: string;
  noItems: string;
  orderedTitle: string;
  noOrders: string;
  statusPending: string;
  statusCooking: string;
  statusDone: string;
  orderSuccess: string;
  orderReceived: string;
  demoMode: string;
  demoDesc: string;
  freeSignup: string;
  demoToastTitle: string;
  demoToastDesc: string;
}> = {
  pt: {
    table: 'Mesa',
    noItems: 'Sem pratos nesta categoria',
    orderedTitle: 'Seus pedidos',
    noOrders: 'Nenhum pedido enviado ainda',
    statusPending: 'Pendente',
    statusCooking: 'Em preparo',
    statusDone: 'Concluido',
    orderSuccess: 'Pedido enviado!',
    orderReceived: 'A cozinha recebeu seu pedido. Aguarde um momento...',
    demoMode: 'Modo demo · os dados sao apenas ilustrativos, o pedido nao sera enviado',
    demoDesc: 'No ambiente real, a cozinha recebera seu pedido imediatamente.',
    freeSignup: 'Criar conta',
    demoToastTitle: 'Modo demonstracao',
    demoToastDesc: 'No ambiente real, a cozinha recebera seu pedido imediatamente.',
  },
  en: {
    table: 'Table',
    noItems: 'No items in this category',
    orderedTitle: 'Your orders',
    noOrders: 'No orders submitted yet',
    statusPending: 'Pending',
    statusCooking: 'Cooking',
    statusDone: 'Done',
    orderSuccess: 'Order placed!',
    orderReceived: 'The kitchen has received your order. Please wait a moment...',
    demoMode: 'Demo mode · data is for display only, orders are not submitted',
    demoDesc: 'In a real setup, the kitchen receives your order instantly.',
    freeSignup: 'Sign up free',
    demoToastTitle: 'Demo mode',
    demoToastDesc: 'In a real setup, the kitchen receives your order instantly.',
  },
  zh: {
    table: '桌号',
    noItems: '此分类暂无菜品',
    orderedTitle: '已下单',
    noOrders: '还没有提交订单',
    statusPending: '待处理',
    statusCooking: '备餐中',
    statusDone: '已完成',
    orderSuccess: '下单成功！',
    orderReceived: '厨房已收到您的订单，请稍候...',
    demoMode: '演示模式 · 数据仅供展示，订单不会真实提交',
    demoDesc: '真实场景中，厨房会立刻收到您的订单。',
    freeSignup: '免费注册',
    demoToastTitle: '这是演示模式',
    demoToastDesc: '真实场景中，厨房会立刻收到您的订单。',
  },
};
