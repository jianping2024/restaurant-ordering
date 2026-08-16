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
  /** Cart drawer title. */
  cartTitle: string;
  /** Cart drawer total label (no currency). */
  cartTotalLabel: string;
  cartNotePlaceholder: string;
  /** Menu card + button aria-label. */
  itemAdd: string;
  itemSoldOut: string;
  noQuickNotes: string;
  /** Item detail close (CustomerMenuItemDetailSheet — phone fullscreen / lg dialog). */
  itemDetailClose: string;
  itemOpenDetailAria: string;
  itemFree: string;
  itemBadgeRound: string;
  itemBadgePaid: string;
  itemAllergensTitle: string;
  itemAllergensUnmarked: string;
  itemDetailDescriptionTitle: string;
  itemDetailDescriptionEmpty: string;
  itemDetailAddToRound: string;
  itemDetailAddToCart: string;
  itemDetailDone: string;
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
    cartTitle: 'Carrinho',
    cartTotalLabel: 'Total',
    cartNotePlaceholder: 'Nota (ex.: sem sal, sem cebola)',
    itemAdd: '+ Adicionar',
    itemSoldOut: 'Esgotado',
    noQuickNotes: 'Sem observacoes rapidas configuradas para este prato.',
    itemDetailClose: 'Fechar',
    itemOpenDetailAria: 'Ver detalhes de {name}',
    itemFree: 'Grátis',
    itemBadgeRound: 'Ronda da mesa',
    itemBadgePaid: 'Pedido imediato',
    itemAllergensTitle: 'Alérgenos',
    itemAllergensUnmarked: 'Não marcado (não significa sem alérgenos)',
    itemDetailDescriptionTitle: 'Descrição',
    itemDetailDescriptionEmpty: 'Sem descrição para este prato.',
    itemDetailAddToRound: 'Adicionar à ronda',
    itemDetailAddToCart: 'Adicionar ao carrinho',
    itemDetailDone: 'Concluído',
  },
  en: {
    table: 'Table',
    noItems: 'No items in this category',
    orderedTitle: 'Ordered',
    orderedDrawerTitle: 'Ordered ({count})',
    orderedSubmittedHint: 'Submitted items can only be changed by staff.',
    noOrders: 'No orders submitted yet',
    orderedCount: '{count} item(s)',
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
    cartTitle: 'Cart',
    cartTotalLabel: 'Total',
    cartNotePlaceholder: 'Notes (e.g. less salt, no onion)',
    itemAdd: '+ Add',
    itemSoldOut: 'Sold out',
    noQuickNotes: 'No quick notes configured for this dish.',
    itemDetailClose: 'Close',
    itemOpenDetailAria: 'View details for {name}',
    itemFree: 'Free',
    itemBadgeRound: 'Table round',
    itemBadgePaid: 'Order now',
    itemAllergensTitle: 'Allergens',
    itemAllergensUnmarked: 'Unmarked (not allergen-free)',
    itemDetailDescriptionTitle: 'Description',
    itemDetailDescriptionEmpty: 'No description for this dish yet.',
    itemDetailAddToRound: 'Add to round',
    itemDetailAddToCart: 'Add to cart',
    itemDetailDone: 'Done',
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
    cartTitle: '购物车',
    cartTotalLabel: '合计',
    cartNotePlaceholder: '备注（如：少盐、不要洋葱）',
    itemAdd: '+ 加入',
    itemSoldOut: '已售完',
    noQuickNotes: '该菜品暂无快捷备注，请直接输入。',
    itemDetailClose: '关闭',
    itemOpenDetailAria: '查看{name}详情',
    itemFree: '免费',
    itemBadgeRound: '同桌轮次',
    itemBadgePaid: '即时下单',
    itemAllergensTitle: '过敏原',
    itemAllergensUnmarked: '未标注（不等于无过敏原）',
    itemDetailDescriptionTitle: '菜品描述',
    itemDetailDescriptionEmpty: '暂无描述',
    itemDetailAddToRound: '加入本轮',
    itemDetailAddToCart: '加入购物车',
    itemDetailDone: '完成',
  },
  es: {
    table: 'Mesa',
    noItems: 'No hay platos en esta categoría',
    orderedTitle: 'Ya pedido',
    orderedDrawerTitle: 'Ya pedido ({count})',
    orderedSubmittedHint: 'Los platos ya enviados solo los puede modificar el personal.',
    noOrders: 'Todavía no has enviado ningún pedido',
    orderedCount: '{count} plato(s)',
    viewOrdered: 'Ver lo pedido',
    continueOrdering: 'Pedir más',
    placeOrder: 'Enviar pedido',
    viewBillLink: 'Ver cuenta',
    billDisabledHint: 'Esta mesa está cerrando la cuenta. Ahora no se pueden añadir platos.',
    submitCooldownWait: 'Espera {seconds} s',
    orderSuccess: '¡Pedido enviado!',
    demoMode: 'Modo demo · los datos son solo de muestra, el pedido no se envía',
    freeSignup: 'Acceso del propietario',
    demoToastTitle: 'Modo demostración',
    demoToastDesc: 'En un local real, la cocina recibe tu pedido al instante.',
    submitFailed: 'No se ha podido enviar el pedido. Inténtalo de nuevo.',
    submitRateLimited: 'Demasiados pedidos seguidos; inténtalo de nuevo en un momento.',
    demoStep: 'Paso 1/3: haz el pedido desde la vista del cliente.',
    demoOpenKitchen: 'Abrir vista de cocina',
    demoOpenWaiter: 'Abrir panel de sala',
    demoBackHub: 'Volver al inicio de la demo',
    viewCart: 'Ver carrito',
    footerTotal: 'Total:',
    locationNotSupported: 'Este dispositivo no admite ubicación. No se puede enviar el pedido.',
    locationPermissionDenied: 'Permite el acceso a la ubicación para pedir en este restaurante.',
    locationCheckFailed: 'No se ha podido verificar tu ubicación. Inténtalo de nuevo.',
    locationTooFar: 'Estás demasiado lejos del restaurante para pedir.',
    locationBypassedLocal:
      'Entorno local detectado: se ha omitido la validación de ubicación para pruebas.',
    printEnqueueNoStation:
      'Pedido guardado, pero no se ha enviado ningún ticket de partida: asigna una impresora de partida a la categoría o al plato en Ajustes del menú.',
    printEnqueueFailed:
      'Pedido guardado, pero falló el envío a la cola de impresión. Revisa el asistente de impresión.',
    printEnqueueRateLimited: 'Demasiadas solicitudes de impresión; inténtalo de nuevo en un minuto.',
    waitingForBuffet:
      'Espera un momento: el personal debe registrar el bufé de esta mesa antes de pedir platos.',
    buffetRequired:
      'Esta mesa aún no está abierta para pedidos. Pide al personal que registre el bufé.',
    sushiLimitHint:
      'Incluye {perPerson} por persona; cada extra €{price}. Pide al personal para superar el límite.',
    perPersonLimitReached:
      'Has alcanzado el límite incluido. Pide al personal que añada más (precio de extra).',
    limitedItemNeedsHeadcount:
      'El personal debe registrar el número de comensales antes de pedir este plato.',
    staffOverageConfirmTitle: 'Confirmar precio de extra',
    staffOverageFirstCrossMessage:
      '«{name}» incluirá {qty} unidad(es) a €{price} cada una como extra al cerrar la cuenta (subtotal €{subtotal}). ¿Continuar?',
    staffOverageMoreToast:
      '«{name}»: +{qty} se cobrarán a €{price} cada una como extra al cerrar la cuenta.',
    staffOverageSubmitTitle: 'Confirmar pedido con extras',
    staffOverageSubmitIntro: 'Al cerrar la cuenta se cobrará precio de extra por:',
    staffOverageSubmitLine: '• {name}: {qty} × €{price} = €{subtotal}',
    staffOverageConfirm: 'Confirmar',
    staffOverageCancel: 'Cancelar',
    subcategoryAll: 'Todo',
    catalogLoading: 'Cargando la carta…',
    cartTitle: 'Carrito',
    cartTotalLabel: 'Total',
    cartNotePlaceholder: 'Notas (p. ej. poca sal, sin cebolla)',
    itemAdd: '+ Añadir',
    itemSoldOut: 'Agotado',
    noQuickNotes: 'Este plato no tiene notas rápidas; escríbelas aquí.',
    itemDetailClose: 'Cerrar',
    itemOpenDetailAria: 'Ver detalles de {name}',
    itemFree: 'Gratis',
    itemBadgeRound: 'Ronda de la mesa',
    itemBadgePaid: 'Pedido inmediato',
    itemAllergensTitle: 'Alérgenos',
    itemAllergensUnmarked: 'Sin marcar (no significa sin alérgenos)',
    itemDetailDescriptionTitle: 'Descripción',
    itemDetailDescriptionEmpty: 'Sin descripción para este plato.',
    itemDetailAddToRound: 'Añadir a la ronda',
    itemDetailAddToCart: 'Añadir al carrito',
    itemDetailDone: 'Listo',
  },
  fr: {
    table: 'Table',
    noItems: 'Aucun plat dans cette catégorie',
    orderedTitle: 'Déjà commandé',
    orderedDrawerTitle: 'Déjà commandé ({count})',
    orderedSubmittedHint:
      'Les plats déjà envoyés ne peuvent être modifiés que par le personnel.',
    noOrders: 'Aucune commande envoyée pour le moment',
    orderedCount: '{count} plat(s)',
    viewOrdered: 'Voir la commande',
    continueOrdering: 'Commander encore',
    placeOrder: 'Envoyer la commande',
    viewBillLink: 'Voir l’addition',
    billDisabledHint:
      'Cette table est en cours d’encaissement. Impossible d’ajouter des plats pour le moment.',
    submitCooldownWait: 'Patientez {seconds} s',
    orderSuccess: 'Commande envoyée !',
    demoMode: 'Mode démo · données fictives, la commande ne sera pas envoyée',
    freeSignup: 'Connexion gérant',
    demoToastTitle: 'Mode démonstration',
    demoToastDesc: 'En conditions réelles, la cuisine reçoit votre commande immédiatement.',
    submitFailed: 'Échec de l’envoi de la commande, veuillez réessayer.',
    submitRateLimited: 'Trop de commandes envoyées ; réessayez dans un instant.',
    demoStep: 'Étape 1/3 : passez commande depuis la vue client.',
    demoOpenKitchen: 'Ouvrir la vue cuisine',
    demoOpenWaiter: 'Ouvrir le tableau de salle',
    demoBackHub: 'Retour à l’accueil de la démo',
    viewCart: 'Voir le panier',
    footerTotal: 'Total :',
    locationNotSupported:
      'Cet appareil ne prend pas en charge la localisation. Commande impossible.',
    locationPermissionDenied:
      'Autorisez l’accès à la localisation pour commander dans ce restaurant.',
    locationCheckFailed: 'Impossible de vérifier votre position. Veuillez réessayer.',
    locationTooFar: 'Vous êtes trop loin du restaurant pour passer commande.',
    locationBypassedLocal:
      'Environnement local détecté : la vérification de position a été ignorée pour les tests.',
    printEnqueueNoStation:
      'Commande enregistrée, mais aucun bon de poste n’a été mis en file : associez un poste d’impression à la catégorie ou au plat dans les réglages du menu.',
    printEnqueueFailed:
      'Commande enregistrée, mais l’envoi vers la file d’impression a échoué. Vérifiez l’assistant d’impression.',
    printEnqueueRateLimited: 'Trop de demandes d’impression ; réessayez dans une minute.',
    waitingForBuffet:
      'Un instant : le personnel doit enregistrer le buffet de cette table avant toute commande.',
    buffetRequired:
      'Cette table n’est pas encore ouverte. Demandez au personnel d’enregistrer le buffet.',
    sushiLimitHint:
      'Comprend {perPerson}/personne ; supplément €{price} la pièce. Demandez au personnel pour aller au-delà.',
    perPersonLimitReached:
      'Limite incluse atteinte. Demandez au personnel d’en ajouter (prix supplément).',
    limitedItemNeedsHeadcount:
      'Le personnel doit saisir le nombre de couverts avant de commander ce plat.',
    staffOverageConfirmTitle: 'Confirmer le prix supplément',
    staffOverageFirstCrossMessage:
      '« {name} » comptera {qty} pièce(s) au supplément de €{price} l’unité à l’encaissement (sous-total €{subtotal}). Continuer ?',
    staffOverageMoreToast:
      '« {name} » : +{qty} seront facturées au supplément de €{price} l’unité à l’encaissement.',
    staffOverageSubmitTitle: 'Confirmer la commande avec supplément',
    staffOverageSubmitIntro: 'À l’encaissement, un supplément sera facturé pour :',
    staffOverageSubmitLine: '• {name} : {qty} × €{price} = €{subtotal}',
    staffOverageConfirm: 'Confirmer',
    staffOverageCancel: 'Annuler',
    subcategoryAll: 'Tout',
    catalogLoading: 'Chargement de la carte…',
    cartTitle: 'Panier',
    cartTotalLabel: 'Total',
    cartNotePlaceholder: 'Notes (ex. : peu de sel, sans oignon)',
    itemAdd: '+ Ajouter',
    itemSoldOut: 'Épuisé',
    noQuickNotes: 'Pas de notes rapides pour ce plat ; saisissez-les ici.',
    itemDetailClose: 'Fermer',
    itemOpenDetailAria: 'Voir les détails de {name}',
    itemFree: 'Gratuit',
    itemBadgeRound: 'Tour de table',
    itemBadgePaid: 'Commande immédiate',
    itemAllergensTitle: 'Allergènes',
    itemAllergensUnmarked: 'Non renseigné (pas « sans allergène »)',
    itemDetailDescriptionTitle: 'Description',
    itemDetailDescriptionEmpty: 'Pas encore de description pour ce plat.',
    itemDetailAddToRound: 'Ajouter au tour',
    itemDetailAddToCart: 'Ajouter au panier',
    itemDetailDone: 'Terminé',
  },
  de: {
    table: 'Tisch',
    noItems: 'Keine Gerichte in dieser Kategorie',
    orderedTitle: 'Bestellt',
    orderedDrawerTitle: 'Bestellt ({count})',
    orderedSubmittedHint: 'Bereits abgeschickte Gerichte kann nur das Servicepersonal ändern.',
    noOrders: 'Noch keine Bestellung abgeschickt',
    orderedCount: '{count} Gericht(e)',
    viewOrdered: 'Bestellung ansehen',
    continueOrdering: 'Weiter bestellen',
    placeOrder: 'Bestellung abschicken',
    viewBillLink: 'Rechnung ansehen',
    billDisabledHint:
      'Dieser Tisch wird gerade abgerechnet. Es können vorerst keine Gerichte hinzugefügt werden.',
    submitCooldownWait: 'Bitte {seconds} s warten',
    orderSuccess: 'Bestellung aufgegeben!',
    demoMode: 'Demomodus · Daten dienen nur zur Anzeige, es wird nichts bestellt',
    freeSignup: 'Inhaber-Login',
    demoToastTitle: 'Demomodus',
    demoToastDesc: 'Im echten Betrieb erhält die Küche Ihre Bestellung sofort.',
    submitFailed: 'Bestellung konnte nicht gesendet werden. Bitte erneut versuchen.',
    submitRateLimited: 'Zu viele Bestellungen; bitte in einem Moment erneut versuchen.',
    demoStep: 'Schritt 1/3: In der Gastansicht bestellen.',
    demoOpenKitchen: 'Küchenansicht öffnen',
    demoOpenWaiter: 'Service-Board öffnen',
    demoBackHub: 'Zurück zur Demo-Übersicht',
    viewCart: 'Warenkorb ansehen',
    footerTotal: 'Summe:',
    locationNotSupported:
      'Dieses Gerät unterstützt keine Standortbestimmung. Bestellung nicht möglich.',
    locationPermissionDenied:
      'Bitte Standortzugriff erlauben, um in diesem Restaurant zu bestellen.',
    locationCheckFailed: 'Ihr Standort konnte nicht geprüft werden. Bitte erneut versuchen.',
    locationTooFar: 'Sie sind zu weit vom Restaurant entfernt, um zu bestellen.',
    locationBypassedLocal:
      'Lokale Umgebung erkannt: Die Standortprüfung wurde zum Testen übersprungen.',
    printEnqueueNoStation:
      'Bestellung gespeichert, aber kein Stationsbon erstellt: Weisen Sie der Kategorie oder dem Gericht in den Menü-Einstellungen eine Druckstation zu.',
    printEnqueueFailed:
      'Bestellung gespeichert, aber die Übergabe an die Druckwarteschlange ist fehlgeschlagen. Prüfen Sie den Druckassistenten.',
    printEnqueueRateLimited: 'Zu viele Druckaufträge; bitte in einer Minute erneut versuchen.',
    waitingForBuffet:
      'Bitte warten: Das Personal muss zuerst das Buffet für diesen Tisch erfassen.',
    buffetRequired:
      'Dieser Tisch ist noch nicht geöffnet. Bitten Sie das Personal, das Buffet zu erfassen.',
    sushiLimitHint:
      'Inklusive {perPerson} pro Person; jedes weitere €{price}. Für mehr bitte das Personal fragen.',
    perPersonLimitReached:
      'Inklusivmenge erreicht. Für mehr bitte das Personal fragen (Aufpreis).',
    limitedItemNeedsHeadcount:
      'Das Personal muss zuerst die Personenzahl erfassen, bevor dieses Gericht bestellt wird.',
    staffOverageConfirmTitle: 'Aufpreis bestätigen',
    staffOverageFirstCrossMessage:
      '„{name}“ enthält bei der Abrechnung {qty} Stück zum Aufpreis von €{price} je Stück (Zwischensumme €{subtotal}). Fortfahren?',
    staffOverageMoreToast:
      '„{name}“: +{qty} werden bei der Abrechnung mit €{price} je Stück berechnet.',
    staffOverageSubmitTitle: 'Bestellung mit Aufpreis bestätigen',
    staffOverageSubmitIntro: 'Bei der Abrechnung wird ein Aufpreis berechnet für:',
    staffOverageSubmitLine: '• {name}: {qty} × €{price} = €{subtotal}',
    staffOverageConfirm: 'Bestätigen',
    staffOverageCancel: 'Abbrechen',
    subcategoryAll: 'Alle',
    catalogLoading: 'Karte wird geladen…',
    cartTitle: 'Warenkorb',
    cartTotalLabel: 'Summe',
    cartNotePlaceholder: 'Notiz (z. B. wenig Salz, ohne Zwiebel)',
    itemAdd: '+ Hinzufügen',
    itemSoldOut: 'Ausverkauft',
    noQuickNotes: 'Keine Schnellnotizen für dieses Gericht; bitte direkt eingeben.',
    itemDetailClose: 'Schließen',
    itemOpenDetailAria: 'Details zu {name} anzeigen',
    itemFree: 'Gratis',
    itemBadgeRound: 'Tischrunde',
    itemBadgePaid: 'Sofort bestellen',
    itemAllergensTitle: 'Allergene',
    itemAllergensUnmarked: 'Nicht gekennzeichnet (nicht allergenfrei)',
    itemDetailDescriptionTitle: 'Beschreibung',
    itemDetailDescriptionEmpty: 'Noch keine Beschreibung für dieses Gericht.',
    itemDetailAddToRound: 'Zur Runde hinzufügen',
    itemDetailAddToCart: 'In den Warenkorb',
    itemDetailDone: 'Fertig',
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
