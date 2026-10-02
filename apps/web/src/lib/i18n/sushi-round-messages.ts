import type { Language } from '@/types';

/** Customer sushi-round UI copy (zh / en / pt). Countdown send — no vote/defer. */
export const SUSHI_ROUND_MESSAGES: Record<
  Language,
  {
    stickyRoundProgress: string;
    stickyCooldown: string;
    stickyPending: string;
    sendRound: string;
    viewRoundReview: string;
    roundReviewCount: string;
    reviewTitle: string;
    reviewEmpty: string;
    reviewOwnBlock: string;
    reviewCountdownBanner: string;
    placedInRound: string;
    confirmTitle: string;
    /** Use {n} = table cooldown seconds. */
    confirmMessage: string;
    confirmAction: string;
    confirmCancel: string;
    peerNotifyTitle: string;
    /** Use {n} = seconds until kitchen send. */
    peerNotifyMessage: string;
    peerNotifyAction: string;
    sentToast: string;
    guestCountRequired: string;
    roundCapExceeded: string;
    basketLocked: string;
    cooldownActive: string;
    emptyRound: string;
    submitFailed: string;
    introTitle: string;
    introSubtitle: string;
    introStep1Title: string;
    introStep1Body: string;
    introStep2Title: string;
    introStep2Body: string;
    introStep3Title: string;
    introStep3Body: string;
    introCta: string;
  }
> = {
  zh: {
    stickyRoundProgress: '本轮 {qty}/{cap}',
    stickyCooldown: '桌级冷却 {seconds}s',
    stickyPending: '{seconds} 秒后送厨 · 请抓紧点餐',
    sendRound: '送厨本轮',
    viewRoundReview: '本轮核单',
    roundReviewCount: '本轮核单 ({count})',
    reviewTitle: '本轮核单',
    reviewEmpty: '还没有已下单的免费菜',
    reviewOwnBlock: '我',
    reviewCountdownBanner: '{seconds} 秒后送厨 · 请抓紧点餐',
    placedInRound: '已加入本轮核单',
    confirmTitle: '送厨本轮？',
    confirmMessage:
      '建议先和同桌确认好本轮菜品。确认后，倒计时结束将自动送厨，随后进入 {n} 秒送厨冷却时间。现在送厨吗？',
    confirmAction: '确认送厨',
    confirmCancel: '再看看',
    peerNotifyTitle: '同桌已发起送厨',
    peerNotifyMessage: '这轮大约 {n} 秒后送厨，想加点的抓紧～',
    peerNotifyAction: '知道了',
    sentToast: '本轮已送厨',
    guestCountRequired: '请先让服务员登记用餐人数',
    roundCapExceeded: '本轮免费菜已满（{used}/{cap}），请先从「本轮核单」送厨后再点',
    basketLocked: '送厨处理中，暂不可改免费菜',
    cooldownActive: '送厨冷却中，请稍候',
    emptyRound: '请先添加免费菜',
    submitFailed: '操作失败，请重试',
    introTitle: '寿司同桌轮次',
    introSubtitle: '免费菜先下单进本轮，核单后送厨；收费菜即时下单',
    introStep1Title: '加菜下单',
    introStep1Body: '免费菜进购物车，可写备注，点下单后进入本轮核单。',
    introStep2Title: '本轮核单',
    introStep2Body: '核单展示整桌已下的免费菜；顶栏数量是整桌合计。',
    introStep3Title: '送厨倒计时',
    introStep3Body: '从核单发起送厨，确认后倒计时，到点自动送厨；期间仍可加点。',
    introCta: '开始点餐',
  },
  en: {
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyPending: '{seconds}s until kitchen · keep ordering',
    sendRound: 'Send round to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    reviewOwnBlock: 'You',
    reviewCountdownBanner: '{seconds}s until kitchen · keep ordering',
    placedInRound: 'Added to this round',
    confirmTitle: 'Send this round?',
    confirmMessage:
      'Check the dishes with your table first. After confirmation, they’ll be sent to the kitchen automatically after the countdown, followed by an {n}-second wait. Send now?',
    confirmAction: 'Confirm',
    confirmCancel: 'Not yet',
    peerNotifyTitle: 'Someone started kitchen send',
    peerNotifyMessage: 'This round goes to the kitchen in about {n}s — add dishes now if you need to.',
    peerNotifyAction: 'Got it',
    sentToast: 'Round sent to kitchen',
    guestCountRequired: 'Ask staff to set the guest count first',
    roundCapExceeded:
      'This round is full ({used}/{cap}). Open “This round” and send to kitchen before adding more.',
    basketLocked: 'Kitchen send in progress — free dishes locked',
    cooldownActive: 'Table cooldown — please wait',
    emptyRound: 'Add free dishes first',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Place free dishes into this round, review, then send; paid dishes go now',
    introStep1Title: 'Add and place',
    introStep1Body: 'Free dishes go in your cart with notes. Place order to add them to this round.',
    introStep2Title: 'This round',
    introStep2Body: 'Review shows everyone’s free dishes. The top bar shows the table total.',
    introStep3Title: 'Countdown to kitchen',
    introStep3Body: 'Start send from review; after confirm, a countdown runs then auto-send. You can still add dishes.',
    introCta: 'Start ordering',
  },
  pt: {
    stickyRoundProgress: 'Esta ronda {qty}/{cap}',
    stickyCooldown: 'Espera da mesa {seconds}s',
    stickyPending: '{seconds}s até à cozinha · continue a pedir',
    sendRound: 'Enviar ronda à cozinha',
    viewRoundReview: 'Esta ronda',
    roundReviewCount: 'Esta ronda ({count})',
    reviewTitle: 'Esta ronda',
    reviewEmpty: 'Ainda não há pratos grátis nesta ronda',
    reviewOwnBlock: 'Eu',
    reviewCountdownBanner: '{seconds}s até à cozinha · continue a pedir',
    placedInRound: 'Adicionado a esta ronda',
    confirmTitle: 'Enviar esta ronda?',
    confirmMessage:
      'Confirme os pratos com a sua mesa. Após confirmar, serão enviados automaticamente para a cozinha após a contagem decrescente, seguida de {n} segundos de espera. Enviar agora?',
    confirmAction: 'Confirmar',
    confirmCancel: 'Voltar a ver',
    peerNotifyTitle: 'Alguém iniciou o envio',
    peerNotifyMessage: 'Esta ronda vai para a cozinha em cerca de {n}s — peça já se precisar.',
    peerNotifyAction: 'Percebi',
    sentToast: 'Ronda enviada à cozinha',
    guestCountRequired: 'Peça ao staff para registar o número de pessoas',
    roundCapExceeded:
      'Esta ronda está cheia ({used}/{cap}). Abra “Esta ronda” e envie à cozinha antes de pedir mais.',
    basketLocked: 'Envio em curso — pratos grátis bloqueados',
    cooldownActive: 'Espera da mesa — aguarde',
    emptyRound: 'Adicione pratos grátis primeiro',
    submitFailed: 'Algo falhou — tente de novo',
    introTitle: 'Rondas de sushi na mesa',
    introSubtitle: 'Pratos grátis entram na ronda, reveja e envie; pagos vão já',
    introStep1Title: 'Adicionar e pedir',
    introStep1Body: 'Pratos grátis no carrinho com notas. Confirme o pedido para entrar nesta ronda.',
    introStep2Title: 'Esta ronda',
    introStep2Body: 'A revisão mostra os pratos grátis de toda a mesa. O topo mostra o total.',
    introStep3Title: 'Contagem para a cozinha',
    introStep3Body: 'Inicie o envio na revisão; após confirmar corre a contagem e envia sozinho. Ainda pode pedir.',
    introCta: 'Começar a pedir',
  },
  es: {
    stickyRoundProgress: 'Esta ronda {qty}/{cap}',
    stickyCooldown: 'Espera de mesa {seconds}s',
    stickyPending: '{seconds}s hasta cocina · sigue pidiendo',
    sendRound: 'Enviar ronda a cocina',
    viewRoundReview: 'Esta ronda',
    roundReviewCount: 'Esta ronda ({count})',
    reviewTitle: 'Esta ronda',
    reviewEmpty: 'Aún no hay platos gratis en esta ronda',
    reviewOwnBlock: 'Yo',
    reviewCountdownBanner: '{seconds}s hasta cocina · sigue pidiendo',
    placedInRound: 'Añadido a esta ronda',
    confirmTitle: '¿Enviar esta ronda?',
    confirmMessage:
      'Confirma los platos con tu mesa. Tras confirmar, se enviarán a cocina automáticamente tras la cuenta atrás, seguida de {n} segundos de espera. ¿Enviar ahora?',
    confirmAction: 'Confirmar',
    confirmCancel: 'Ahora no',
    peerNotifyTitle: 'Alguien inició el envío',
    peerNotifyMessage: 'Esta ronda va a cocina en unos {n}s — pide ya si lo necesitas.',
    peerNotifyAction: 'Entendido',
    sentToast: 'Ronda enviada a cocina',
    guestCountRequired: 'Pide al personal que registre el número de comensales',
    roundCapExceeded:
      'Esta ronda está llena ({used}/{cap}). Abre “Esta ronda” y envía a cocina antes de pedir más.',
    basketLocked: 'Envío en curso — platos gratis bloqueados',
    cooldownActive: 'Espera de mesa — espera un momento',
    emptyRound: 'Añade platos gratis primero',
    submitFailed: 'Algo falló — reintenta',
    introTitle: 'Rondas de sushi en la mesa',
    introSubtitle: 'Los platos gratis entran en la ronda, revisa y envía; los de pago van ya',
    introStep1Title: 'Añadir y pedir',
    introStep1Body: 'Platos gratis en el carrito con notas. Confirma el pedido para entrar en esta ronda.',
    introStep2Title: 'Esta ronda',
    introStep2Body: 'La revisión muestra los platos gratis de toda la mesa. La barra superior muestra el total.',
    introStep3Title: 'Cuenta atrás a cocina',
    introStep3Body: 'Inicia el envío en la revisión; tras confirmar corre la cuenta y se envía solo. Aún puedes pedir.',
    introCta: 'Empezar a pedir',
  },
  fr: {
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyPending: '{seconds}s until kitchen · keep ordering',
    sendRound: 'Send round to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    reviewOwnBlock: 'You',
    reviewCountdownBanner: '{seconds}s until kitchen · keep ordering',
    placedInRound: 'Added to this round',
    confirmTitle: 'Send this round?',
    confirmMessage:
      'Check the dishes with your table first. After confirmation, they’ll be sent to the kitchen automatically after the countdown, followed by an {n}-second wait. Send now?',
    confirmAction: 'Confirm',
    confirmCancel: 'Not yet',
    peerNotifyTitle: 'Someone started kitchen send',
    peerNotifyMessage: 'This round goes to the kitchen in about {n}s — add dishes now if you need to.',
    peerNotifyAction: 'Got it',
    sentToast: 'Round sent to kitchen',
    guestCountRequired: 'Ask staff to set the guest count first',
    roundCapExceeded:
      'This round is full ({used}/{cap}). Open “This round” and send to kitchen before adding more.',
    basketLocked: 'Kitchen send in progress — free dishes locked',
    cooldownActive: 'Table cooldown — please wait',
    emptyRound: 'Add free dishes first',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Place free dishes into this round, review, then send; paid dishes go now',
    introStep1Title: 'Add and place',
    introStep1Body: 'Free dishes go in your cart with notes. Place order to add them to this round.',
    introStep2Title: 'This round',
    introStep2Body: 'Review shows everyone’s free dishes. The top bar shows the table total.',
    introStep3Title: 'Countdown to kitchen',
    introStep3Body:
      'Start send from review; after confirm, a countdown runs then auto-send. You can still add dishes.',
    introCta: 'Start ordering',
  },
  de: {
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyPending: '{seconds}s until kitchen · keep ordering',
    sendRound: 'Send round to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    reviewOwnBlock: 'You',
    reviewCountdownBanner: '{seconds}s until kitchen · keep ordering',
    placedInRound: 'Added to this round',
    confirmTitle: 'Send this round?',
    confirmMessage:
      'Check the dishes with your table first. After confirmation, they’ll be sent to the kitchen automatically after the countdown, followed by an {n}-second wait. Send now?',
    confirmAction: 'Confirm',
    confirmCancel: 'Not yet',
    peerNotifyTitle: 'Someone started kitchen send',
    peerNotifyMessage: 'This round goes to the kitchen in about {n}s — add dishes now if you need to.',
    peerNotifyAction: 'Got it',
    sentToast: 'Round sent to kitchen',
    guestCountRequired: 'Ask staff to set the guest count first',
    roundCapExceeded:
      'This round is full ({used}/{cap}). Open “This round” and send to kitchen before adding more.',
    basketLocked: 'Kitchen send in progress — free dishes locked',
    cooldownActive: 'Table cooldown — please wait',
    emptyRound: 'Add free dishes first',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Place free dishes into this round, review, then send; paid dishes go now',
    introStep1Title: 'Add and place',
    introStep1Body: 'Free dishes go in your cart with notes. Place order to add them to this round.',
    introStep2Title: 'This round',
    introStep2Body: 'Review shows everyone’s free dishes. The top bar shows the table total.',
    introStep3Title: 'Countdown to kitchen',
    introStep3Body:
      'Start send from review; after confirm, a countdown runs then auto-send. You can still add dishes.',
    introCta: 'Start ordering',
  },
};

export function messageForSushiRoundError(
  code: string | undefined,
  t: (typeof SUSHI_ROUND_MESSAGES)[Language],
  progress?: { used: number; cap: number },
): string {
  switch (code) {
    case 'guest_count_required':
      return t.guestCountRequired;
    case 'round_cap_exceeded':
      return t.roundCapExceeded
        .replace('{used}', String(progress?.used ?? 0))
        .replace('{cap}', String(progress?.cap ?? 0));
    case 'round_basket_locked':
      return t.basketLocked;
    case 'round_cooldown_active':
      return t.cooldownActive;
    case 'round_empty':
      return t.emptyRound;
    default:
      return t.submitFailed;
  }
}
