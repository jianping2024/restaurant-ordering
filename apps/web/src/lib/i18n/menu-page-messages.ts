import type { Language } from '@/types';

export const MENU_PAGE_MESSAGES: Record<Language, {
  table: string;
  noItems: string;
  orderedTitle: string;
  orderedDrawerTitle: string;
  orderedSubmittedHint: string;
  noOrders: string;
  orderedCount: string;
  viewOrdered: string;
  continueOrdering: string;
  placeOrder: string;
  viewBillLink: string;
  billDisabledHint: string;
  submitCooldownWait: string;
  orderSuccess: string;
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
  footerTotal: string;
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
  sushiLimitHint: string;
  perPersonLimitReached: string;
  limitedItemNeedsHeadcount: string;
  staffOverageConfirmTitle: string;
  staffOverageFirstCrossMessage: string;
  staffOverageMoreToast: string;
  staffOverageSubmitTitle: string;
  staffOverageSubmitIntro: string;
  staffOverageSubmitLine: string;
  staffOverageConfirm: string;
  staffOverageCancel: string;
  subcategoryAll: string;
  catalogLoading: string;
}> = {
  pt: {
    table: 'Mesa',
    noItems: 'Sem pratos nesta categoria',
    orderedTitle: 'Pedidos feitos',
    orderedDrawerTitle: 'Pedidos feitos ({count})',
    orderedSubmittedHint: 'Pratos ja enviados: peca ao staff para alterar.',
    noOrders: 'Nenhum pedido enviado ainda',
    orderedCount: '{count} prato(s)',
    viewOrdered: 'Ver pedidos',
    continueOrdering: 'Pedir mais',
    placeOrder: 'Enviar pedido',
    viewBillLink: 'Ver conta',
    billDisabledHint: 'Esta mesa esta em processo de fechamento. Nao e possivel adicionar novos pratos agora.',
    submitCooldownWait: 'Aguarde {seconds} s',
    orderSuccess: 'Pedido enviado!',
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
    footerTotal: 'Total:',
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
    sushiLimitHint: 'Inclui {perPerson}/pessoa; extra €{price}/un. Pecao staff para ultrapassar.',
    perPersonLimitReached: 'Atingiu o limite incluido. Peca ao staff para adicionar (preco extra).',
    limitedItemNeedsHeadcount: 'Registe primeiro o numero de pessoas na mesa para pedir este prato.',
    staffOverageConfirmTitle: 'Confirmar preco extra',
    staffOverageFirstCrossMessage:
      '"{name}" tera {qty} un. ao preco extra €{price}/un. no fecho da conta (subtotal €{subtotal}). Continuar?',
    staffOverageMoreToast:
      '"{name}": +{qty} un. serao cobradas ao preco extra €{price}/un. no fecho.',
    staffOverageSubmitTitle: 'Confirmar envio com extra',
    staffOverageSubmitIntro: 'No fecho da conta sera cobrado preco extra para:',
    staffOverageSubmitLine: '• {name}: {qty} × €{price} = €{subtotal}',
    staffOverageConfirm: 'Confirmar',
    staffOverageCancel: 'Cancelar',
    subcategoryAll: 'Tudo',
    catalogLoading: 'A carregar menu…',
  },
  en: {
    table: 'Table',
    noItems: 'No items in this category',
    orderedTitle: 'Ordered',
    orderedDrawerTitle: 'Ordered ({count})',
    orderedSubmittedHint: 'Submitted items can only be changed by staff.',
    noOrders: 'No orders submitted yet',
    orderedCount: '{count} item(s) ordered',
    viewOrdered: 'View ordered',
    continueOrdering: 'Order more',
    placeOrder: 'Place order',
    viewBillLink: 'View bill',
    billDisabledHint: 'This table is currently in checkout. Adding new dishes is temporarily unavailable.',
    submitCooldownWait: 'Wait {seconds}s',
    orderSuccess: 'Order placed!',
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
    footerTotal: 'Total:',
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
    sushiLimitHint: 'Includes {perPerson}/person; overage €{price} each. Ask staff to order more.',
    perPersonLimitReached: 'Included limit reached. Ask staff to add more (overage price).',
    limitedItemNeedsHeadcount: 'Staff must set the table headcount before ordering this dish.',
    staffOverageConfirmTitle: 'Confirm overage price',
    staffOverageFirstCrossMessage:
      '"{name}" will include {qty} at overage €{price} each at checkout (subtotal €{subtotal}). Continue?',
    staffOverageMoreToast:
      '"{name}": +{qty} will be charged at overage €{price} each at checkout.',
    staffOverageSubmitTitle: 'Confirm order with overage',
    staffOverageSubmitIntro: 'At checkout, this order will charge overage for:',
    staffOverageSubmitLine: '• {name}: {qty} × €{price} = €{subtotal}',
    staffOverageConfirm: 'Confirm',
    staffOverageCancel: 'Cancel',
    subcategoryAll: 'All',
    catalogLoading: 'Loading menu…',
  },
  zh: {
    table: '桌号',
    noItems: '此分类暂无菜品',
    orderedTitle: '已点菜品',
    orderedDrawerTitle: '已点菜品 ({count})',
    orderedSubmittedHint: '已提交的菜品如需修改，请联系服务员',
    noOrders: '还没有提交订单',
    orderedCount: '已点 {count} 份',
    viewOrdered: '查看已点',
    continueOrdering: '继续点餐',
    placeOrder: '去下单',
    viewBillLink: '查看账单',
    billDisabledHint: '当前餐次正在结账，暂时不能加菜',
    submitCooldownWait: '请等待 {seconds} 秒',
    orderSuccess: '下单成功！',
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
    footerTotal: '合计：',
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
    sushiLimitHint: '含每人 {perPerson} 份；超出每份 €{price}。超额请找员工代点。',
    perPersonLimitReached: '已达免费额度。超额请找员工代点（按超额价）。',
    limitedItemNeedsHeadcount: '请先登记本桌人数后再点此限量菜。',
    staffOverageConfirmTitle: '确认超额计价',
    staffOverageFirstCrossMessage:
      '「{name}」结账时将有 {qty} 份按超额价 €{price}/份计费（小计 €{subtotal}）。确认继续？',
    staffOverageMoreToast:
      '「{name}」再增 {qty} 份，结账时将按超额价 €{price}/份计费',
    staffOverageSubmitTitle: '确认提交（含结账收费份）',
    staffOverageSubmitIntro: '结账时将按超额价收取：',
    staffOverageSubmitLine: '• {name}：{qty} 份 × €{price} = €{subtotal}',
    staffOverageConfirm: '确认',
    staffOverageCancel: '取消',
    subcategoryAll: '全部',
    catalogLoading: '正在加载菜单…',
  },
};

/** Interpolate staff overage confirm/toast/submit copy ({name}, {qty}, {price}, {subtotal}). */
export function formatStaffOverageMessage(
  template: string,
  parts: { name: string; qty: number; price: number; subtotal?: number },
): string {
  const price = parts.price.toFixed(2);
  const subtotal = (parts.subtotal ?? parts.qty * parts.price).toFixed(2);
  return template
    .replace('{name}', parts.name)
    .replace('{qty}', String(parts.qty))
    .replace('{price}', price)
    .replace('{subtotal}', subtotal);
}

export function formatStaffSubmitOverageMessage(
  lines: Array<{ name: string; qty: number; price: number }>,
  messages: Pick<
    (typeof MENU_PAGE_MESSAGES)[Language],
    'staffOverageSubmitIntro' | 'staffOverageSubmitLine'
  >,
): string {
  const body = lines
    .map((line) => formatStaffOverageMessage(messages.staffOverageSubmitLine, line))
    .join('\n');
  return `${messages.staffOverageSubmitIntro}\n${body}`;
}

/** One toast copy path for sushi limit gate / append failures. */
export function messageForSushiLimitError(
  error: string,
  messages: Pick<
    (typeof MENU_PAGE_MESSAGES)[Language],
    'limitedItemNeedsHeadcount' | 'perPersonLimitReached' | 'submitFailed'
  >,
): string {
  if (error === 'limited_item_requires_headcount') return messages.limitedItemNeedsHeadcount;
  if (error === 'per_person_limit_exceeded') return messages.perPersonLimitReached;
  return messages.submitFailed;
}
