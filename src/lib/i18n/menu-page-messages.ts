import type { Language } from '@/types';

export const MENU_PAGE_MESSAGES: Record<Language, {
  table: string;
  noItems: string;
  orderedTitle: string;
  noOrders: string;
  billCta: string;
  billDisabledHint: string;
  statusPending: string;
  statusCooking: string;
  statusDone: string;
  statusVoided: string;
  orderSuccess: string;
  orderReceived: string;
  firstOrderSuccess: string;
  addOnOrderSuccess: string;
  reOpenOrderSuccess: string;
  newTag: string;
  demoMode: string;
  freeSignup: string;
  demoToastTitle: string;
  demoToastDesc: string;
  submitFailed: string;
  demoStep: string;
  demoOpenKitchen: string;
  demoOpenWaiter: string;
  demoBackHub: string;
  viewCart: string;
}> = {
  pt: {
    table: 'Mesa',
    noItems: 'Sem pratos nesta categoria',
    orderedTitle: 'Seus pedidos',
    noOrders: 'Nenhum pedido enviado ainda',
    billCta: 'Ir para conta',
    billDisabledHint: 'A conta abre quando houver itens concluidos.',
    statusPending: 'Pendente',
    statusCooking: 'Em preparo',
    statusDone: 'Concluido',
    statusVoided: 'Cancelado',
    orderSuccess: 'Pedido enviado!',
    orderReceived: 'A cozinha recebeu seu pedido. Aguarde um momento...',
    firstOrderSuccess: 'Pedido enviado com sucesso!',
    addOnOrderSuccess: 'Adicao enviada com sucesso!',
    reOpenOrderSuccess: 'Novo pedido enviado para esta mesa!',
    newTag: 'NOVO',
    demoMode: 'Modo demo · os dados sao apenas ilustrativos, o pedido nao sera enviado',
    freeSignup: 'Criar conta',
    demoToastTitle: 'Modo demonstracao',
    demoToastDesc: 'No ambiente real, a cozinha recebera seu pedido imediatamente.',
    submitFailed: 'Falha ao enviar pedido, tente novamente.',
    demoStep: 'Passo 1/3: faça o pedido na visão do cliente.',
    demoOpenKitchen: 'Abrir visão da cozinha',
    demoOpenWaiter: 'Abrir painel do garcom',
    demoBackHub: 'Voltar ao hub demo',
    viewCart: 'Ver carrinho',
  },
  en: {
    table: 'Table',
    noItems: 'No items in this category',
    orderedTitle: 'Your orders',
    noOrders: 'No orders submitted yet',
    billCta: 'Go to bill',
    billDisabledHint: 'Bill is available after items are completed.',
    statusPending: 'Pending',
    statusCooking: 'Cooking',
    statusDone: 'Done',
    statusVoided: 'Cancelled',
    orderSuccess: 'Order placed!',
    orderReceived: 'The kitchen has received your order. Please wait a moment...',
    firstOrderSuccess: 'Order placed successfully!',
    addOnOrderSuccess: 'Additional items sent successfully!',
    reOpenOrderSuccess: 'New round sent for this table!',
    newTag: 'NEW',
    demoMode: 'Demo mode · data is for display only, orders are not submitted',
    freeSignup: 'Sign up free',
    demoToastTitle: 'Demo mode',
    demoToastDesc: 'In a real setup, the kitchen receives your order instantly.',
    submitFailed: 'Failed to submit order, please try again.',
    demoStep: 'Step 1/3: place order from customer view.',
    demoOpenKitchen: 'Open kitchen view',
    demoOpenWaiter: 'Open waiter dashboard',
    demoBackHub: 'Back to demo hub',
    viewCart: 'View cart',
  },
  zh: {
    table: '桌号',
    noItems: '此分类暂无菜品',
    orderedTitle: '已下单',
    noOrders: '还没有提交订单',
    billCta: '去结账',
    billDisabledHint: '有已完成菜品后可结账',
    statusPending: '待处理',
    statusCooking: '备餐中',
    statusDone: '已完成',
    statusVoided: '已取消',
    orderSuccess: '下单成功！',
    orderReceived: '厨房已收到您的订单，请稍候...',
    firstOrderSuccess: '下单成功！',
    addOnOrderSuccess: '加单成功，厨房已收到',
    reOpenOrderSuccess: '本桌新一轮加单已发送',
    newTag: '新加',
    demoMode: '演示模式 · 数据仅供展示，订单不会真实提交',
    freeSignup: '免费注册',
    demoToastTitle: '这是演示模式',
    demoToastDesc: '真实场景中，厨房会立刻收到您的订单。',
    submitFailed: '提交失败，请重试',
    demoStep: '第 1/3 步：在顾客端完成下单。',
    demoOpenKitchen: '打开后厨视图',
    demoOpenWaiter: '打开服务员看板',
    demoBackHub: '返回演示首页',
    viewCart: '查看购物车',
  },
};
