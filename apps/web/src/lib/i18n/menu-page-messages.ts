import type { Language } from '@/types';

export const MENU_PAGE_MESSAGES: Record<Language, {
  table: string;
  noItems: string;
  orderedTitle: string;
  orderedSubmittedHint: string;
  noOrders: string;
  viewBillLink: string;
  billDisabledHint: string;
  submitCooldownWait: string;
  orderSuccess: string;
  newTag: string;
  demoMode: string;
  freeSignup: string;
  demoToastTitle: string;
  demoToastDesc: string;
  submitFailed: string;
  submitRateLimited: string;
  demoStep: string;
  demoOpenKitchen: string;
  demoOpenWaiter: string;
  demoBackHub: string;
  viewCart: string;
  locationNotSupported: string;
  locationPermissionDenied: string;
  locationCheckFailed: string;
  locationTooFar: string;
  locationBypassedLocal: string;
  printEnqueueNoStation: string;
  printEnqueueFailed: string;
  printEnqueueRateLimited: string;
  waitingForBuffet: string;
  buffetRequired: string;
  subcategoryAll: string;
}> = {
  pt: {
    table: 'Mesa',
    noItems: 'Sem pratos nesta categoria',
    orderedTitle: 'Pedidos feitos',
    orderedSubmittedHint: 'Pratos ja enviados: peca ao staff para alterar.',
    noOrders: 'Nenhum pedido enviado ainda',
    viewBillLink: 'Ver conta',
    billDisabledHint: 'Esta mesa esta em processo de fechamento. Nao e possivel adicionar novos pratos agora.',
    submitCooldownWait: 'Aguarde {seconds} s',
    orderSuccess: 'Pedido enviado!',
    newTag: 'NOVO',
    demoMode: 'Modo demo · os dados sao apenas ilustrativos, o pedido nao sera enviado',
    freeSignup: 'Login do dono',
    demoToastTitle: 'Modo demonstracao',
    demoToastDesc: 'No ambiente real, a cozinha recebera seu pedido imediatamente.',
    submitFailed: 'Falha ao enviar pedido, tente novamente.',
    submitRateLimited: 'Demasiados pedidos; tente novamente dentro de um minuto.',
    demoStep: 'Passo 1/3: faça o pedido na visão do cliente.',
    demoOpenKitchen: 'Abrir visão da cozinha',
    demoOpenWaiter: 'Abrir painel do garcom',
    demoBackHub: 'Voltar ao hub demo',
    viewCart: 'Ver carrinho',
    locationNotSupported: 'Este dispositivo nao suporta localizacao. Nao foi possivel enviar o pedido.',
    locationPermissionDenied: 'Permita o acesso a localizacao para fazer pedidos neste restaurante.',
    locationCheckFailed: 'Nao foi possivel validar sua localizacao. Tente novamente.',
    locationTooFar: 'Esta demasiado longe do restaurante para fazer o pedido.',
    locationBypassedLocal: 'Ambiente local detectado: validacao de localizacao foi ignorada para testes.',
    printEnqueueNoStation:
      'Pedido guardado, mas nenhum talao de estacao: ligue uma estacao de impressao na categoria ou no prato (Menu nas definicoes).',
    printEnqueueFailed: 'Pedido guardado, mas o envio para impressao falhou. Verifique o assistente de impressao.',
    printEnqueueRateLimited: 'Demasiados pedidos de impressao; tente novamente dentro de um minuto.',
    waitingForBuffet: 'Aguarde: o garcom deve registar o buffet desta mesa antes de pedir pratos.',
    buffetRequired: 'O garcom ainda nao activou esta mesa. Peça para registar o buffet primeiro.',
    subcategoryAll: 'Tudo',
  },
  en: {
    table: 'Table',
    noItems: 'No items in this category',
    orderedTitle: 'Ordered',
    orderedSubmittedHint: 'Submitted items can only be changed by staff.',
    noOrders: 'No orders submitted yet',
    viewBillLink: 'View bill',
    billDisabledHint: 'This table is currently in checkout. Adding new dishes is temporarily unavailable.',
    submitCooldownWait: 'Wait {seconds}s',
    orderSuccess: 'Order placed!',
    newTag: 'NEW',
    demoMode: 'Demo mode · data is for display only, orders are not submitted',
    freeSignup: 'Owner login',
    demoToastTitle: 'Demo mode',
    demoToastDesc: 'In a real setup, the kitchen receives your order instantly.',
    submitFailed: 'Failed to submit order, please try again.',
    submitRateLimited: 'Too many order requests; please try again in a moment.',
    demoStep: 'Step 1/3: place order from customer view.',
    demoOpenKitchen: 'Open kitchen view',
    demoOpenWaiter: 'Open waiter dashboard',
    demoBackHub: 'Back to demo hub',
    viewCart: 'View cart',
    locationNotSupported: 'This device does not support location. Unable to place order.',
    locationPermissionDenied: 'Please allow location access to place orders for this restaurant.',
    locationCheckFailed: 'Unable to verify your location. Please try again.',
    locationTooFar: 'You are too far from the restaurant to place an order.',
    locationBypassedLocal: 'Local environment detected: location validation was skipped for testing.',
    printEnqueueNoStation:
      'Order saved, but no station ticket was queued. Assign a print station on the category or dish in Menu settings.',
    printEnqueueFailed: 'Order saved, but sending to the print queue failed. Check Print assistant.',
    printEnqueueRateLimited: 'Too many print requests; please try again in a minute.',
    waitingForBuffet: 'Please wait: staff must post buffet for this table before you can order dishes.',
    buffetRequired: 'This table is not open for ordering yet. Ask staff to post buffet first.',
    subcategoryAll: 'All',
  },
  zh: {
    table: '桌号',
    noItems: '此分类暂无菜品',
    orderedTitle: '已点单',
    orderedSubmittedHint: '已提交的菜品如需修改，请联系服务员',
    noOrders: '还没有提交订单',
    viewBillLink: '查看账单',
    billDisabledHint: '当前餐次正在结账，暂时不能加菜',
    submitCooldownWait: '请等待 {seconds} 秒',
    orderSuccess: '下单成功！',
    newTag: '新加',
    demoMode: '演示模式 · 数据仅供展示，订单不会真实提交',
    freeSignup: '店主登录',
    demoToastTitle: '这是演示模式',
    demoToastDesc: '真实场景中，厨房会立刻收到您的订单。',
    submitFailed: '提交失败，请重试',
    submitRateLimited: '下单过于频繁，请稍后再试',
    demoStep: '第 1/3 步：在顾客端完成下单。',
    demoOpenKitchen: '打开后厨视图',
    demoOpenWaiter: '打开服务员看板',
    demoBackHub: '返回演示首页',
    viewCart: '查看购物车',
    locationNotSupported: '当前设备不支持定位，无法提交订单',
    locationPermissionDenied: '请先允许定位权限，再进行下单',
    locationCheckFailed: '定位校验失败，请重试',
    locationTooFar: '离店过远，无法下单',
    locationBypassedLocal: '当前为本地环境，已跳过定位校验（仅用于调试）',
    printEnqueueNoStation:
      '订单已保存，但未打出品联：请在「菜单管理 → 出品档口」定义档口，并在分类或菜品上绑定。',
    printEnqueueFailed: '订单已保存，但送入打印队列失败，请检查打印助手与代理。',
    printEnqueueRateLimited: '打印请求过于频繁，请稍后再试。',
    waitingForBuffet: '请稍候：服务员需先为本桌登记自助餐后，方可点菜。',
    buffetRequired: '本桌尚未开台，请先请服务员登记自助餐。',
    subcategoryAll: '全部',
  },
};
