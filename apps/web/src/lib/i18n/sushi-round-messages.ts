import type { Language } from '@/types';
import type { GuestRoundQtyPreviewResult } from '@/lib/table-order-round/round-meal-limit';
import type { SushiSendGuidance } from '@/lib/table-order-round/send-guidance';
import { messageForSushiLimitError, MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

/** Customer sushi-round UI copy (zh / en / pt / es; fr/de use en). Countdown send — no vote/defer. */
export const SUSHI_ROUND_MESSAGES: Record<
  Language,
  {
    /** Empty round sticky slot: max-per-round short hint (cap = round_cap_total). */
    stickyRoundCapHint: string;
    /** Round has lines sticky slot: qty/cap (send state lives in the guidance strip only). */
    stickyRoundProgress: string;
    sendRound: string;
    /** Footer CTA → round review when nothing waits for the guest to send. */
    viewRoundReview: string;
    roundReviewCount: string;
    reviewTitle: string;
    reviewEmpty: string;
    reviewOwnBlock: string;
    /** Guidance steps: joined round → send → sent. */
    guidanceStepJoin: string;
    guidanceStepSend: string;
    guidanceStepSent: string;
    /** {qty} = unsent table round qty. */
    guidanceUnsent: string;
    /** {qty}/{cap} = full round. */
    guidanceFull: string;
    /** {seconds} until auto send. */
    guidanceCountdown: string;
    guidanceFailed: string;
    /** {seconds} of table cooldown left. */
    guidanceSent: string;
    /** Footer CTA → round review while the table round is unsent; {count} = table qty. */
    goToSend: string;
    /** Round review dismiss while the round can still be sent. */
    reviewNotYet: string;
    /** Cart submit: free dishes only. */
    addToRound: string;
    /** Cart submit: paid dishes (sent now) + free dishes (join round). */
    placeOrderAndRound: string;
    placedInRound: string;
    /** Mixed cart submit: paid sent now + free joined round. */
    placedMixed: string;
    /** Round review read-only section: paid dishes already sent this round. */
    reviewPaidSentTitle: string;
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
    guestClientLimit: string;
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
    stickyRoundCapHint: '每轮最多 {cap}',
    stickyRoundProgress: '本轮 {qty}/{cap}',
    sendRound: '送厨本轮',
    viewRoundReview: '查看本轮',
    roundReviewCount: '本轮核单 ({count})',
    reviewTitle: '本轮核单',
    reviewEmpty: '还没有已下单的免费菜',
    reviewOwnBlock: '我',
    guidanceStepJoin: '加入本轮',
    guidanceStepSend: '送厨',
    guidanceStepSent: '已送厨',
    guidanceUnsent: '本桌 {qty} 道菜，厨房还没收到',
    guidanceFull: '本轮已满 {qty}/{cap}，先送厨再点',
    guidanceCountdown: '{seconds} 秒后自动送厨 · 同桌还能加',
    guidanceFailed: '送厨未成功，正在重试；一直不行请叫服务员',
    guidanceSent: '已送厨 · 收费菜可继续点 · {seconds} 秒后开下一轮',
    goToSend: '去送厨 · {count} 道',
    reviewNotYet: '先不送厨',
    addToRound: '加入本轮',
    placeOrderAndRound: '下单并加入本轮',
    placedInRound: '已加入本轮 · 还没送厨',
    placedMixed: '收费菜已送厨 · 免费菜已加入本轮',
    reviewPaidSentTitle: '收费菜 · 已直接送厨',
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
    cooldownActive: '免费菜等下一轮；收费菜可继续点',
    emptyRound: '请先添加免费菜',
    guestClientLimit: '本桌点餐手机已满，请找服务员帮忙点单',
    submitFailed: '操作失败，请重试',
    introTitle: '寿司同桌轮次',
    introSubtitle: '免费菜加入本轮后，要点「送厨」厨房才开始做；收费菜下单即送',
    introStep1Title: '加入本轮',
    introStep1Body: '免费菜放进购物车（可写备注），点「加入本轮」；同桌共用这一轮。',
    introStep2Title: '送厨',
    introStep2Body: '底部提示「厨房还没收到」时，点「去送厨」→「送厨本轮」；倒计时结束自动送出，期间同桌还能加。',
    introStep3Title: '下一轮',
    introStep3Body: '送厨后底部显示倒计时；收费菜可继续点，免费菜等结束后开下一轮。',
    introCta: '开始点餐',
  },
  en: {
    stickyRoundCapHint: 'max {cap}',
    stickyRoundProgress: 'round {qty}/{cap}',
    sendRound: 'Send to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    reviewOwnBlock: 'You',
    guidanceStepJoin: 'In round',
    guidanceStepSend: 'Send',
    guidanceStepSent: 'Sent',
    guidanceUnsent: 'Kitchen hasn’t got these yet · {qty} in this round',
    guidanceFull: 'Round full ({qty}/{cap}) · send it first',
    guidanceCountdown: 'Auto-send in {seconds}s · table can still add',
    guidanceFailed: 'Send failed, retrying · ask staff if it persists',
    guidanceSent: 'Sent · paid dishes OK · next free round in {seconds}s',
    goToSend: 'Send · {count}',
    reviewNotYet: 'Not yet',
    addToRound: 'Add to round',
    placeOrderAndRound: 'Order + add to round',
    placedInRound: 'Added to round · not sent yet',
    placedMixed: 'Paid dishes sent · free dishes added to round',
    reviewPaidSentTitle: 'Paid dishes · already sent',
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
    cooldownActive: 'Free dishes wait for next round — paid dishes OK now',
    emptyRound: 'Add free dishes first',
    guestClientLimit: 'This table has reached its phone limit — please ask staff to order for you',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Free dishes join this round, but the kitchen starts only after “Send”; paid dishes go straight away',
    introStep1Title: 'Add to round',
    introStep1Body: 'Put free dishes in your cart (notes OK) and tap “Add to round” — the table shares one round.',
    introStep2Title: 'Send',
    introStep2Body: 'When the bar says the kitchen hasn’t got them, tap “Send”, then “Send to kitchen”. A short countdown lets the table add more.',
    introStep3Title: 'Next round',
    introStep3Body:
      'After sending, the bar counts down; paid dishes stay available, free dishes wait for the next round.',
    introCta: 'Start ordering',
  },
  pt: {
    stickyRoundCapHint: 'máx. {cap}',
    stickyRoundProgress: 'ronda {qty}/{cap}',
    sendRound: 'Enviar à cozinha',
    viewRoundReview: 'Esta ronda',
    roundReviewCount: 'Esta ronda ({count})',
    reviewTitle: 'Esta ronda',
    reviewEmpty: 'Ainda não há pratos grátis nesta ronda',
    reviewOwnBlock: 'Eu',
    guidanceStepJoin: 'Na ronda',
    guidanceStepSend: 'Enviar',
    guidanceStepSent: 'Enviado',
    guidanceUnsent: 'A cozinha ainda não recebeu · {qty} nesta ronda',
    guidanceFull: 'Ronda cheia ({qty}/{cap}) · envie primeiro',
    guidanceCountdown: 'Envio automático em {seconds}s · a mesa ainda pode pedir',
    guidanceFailed: 'Falha no envio, a repetir · chame o staff',
    guidanceSent: 'Enviado · pratos pagos OK · próxima ronda grátis em {seconds}s',
    goToSend: 'Enviar · {count}',
    reviewNotYet: 'Ainda não',
    addToRound: 'Juntar à ronda',
    placeOrderAndRound: 'Pedir + juntar à ronda',
    placedInRound: 'Na ronda · ainda não enviado',
    placedMixed: 'Pagos enviados · grátis na ronda',
    reviewPaidSentTitle: 'Pratos pagos · já enviados',
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
    cooldownActive: 'Grátis esperam a próxima ronda — pratos pagos OK agora',
    emptyRound: 'Adicione pratos grátis primeiro',
    guestClientLimit: 'Esta mesa atingiu o limite de telemóveis — peça ao staff para fazer o pedido',
    submitFailed: 'Algo falhou — tente de novo',
    introTitle: 'Rondas de sushi na mesa',
    introSubtitle: 'Os pratos grátis entram na ronda, mas a cozinha só começa depois de “Enviar”; os pagos vão já',
    introStep1Title: 'Juntar à ronda',
    introStep1Body: 'Ponha os pratos grátis no carrinho (com notas) e toque em “Juntar à ronda” — a mesa partilha a ronda.',
    introStep2Title: 'Enviar',
    introStep2Body: 'Quando a barra disser que a cozinha ainda não recebeu, toque em “Enviar” e depois “Enviar à cozinha”. Uma contagem curta deixa a mesa juntar mais.',
    introStep3Title: 'Próxima ronda',
    introStep3Body:
      'Depois de enviar, a barra conta; pratos pagos continuam, grátis esperam a próxima ronda.',
    introCta: 'Começar a pedir',
  },
  es: {
    stickyRoundCapHint: 'máx. {cap}',
    stickyRoundProgress: 'ronda {qty}/{cap}',
    sendRound: 'Enviar a cocina',
    viewRoundReview: 'Esta ronda',
    roundReviewCount: 'Esta ronda ({count})',
    reviewTitle: 'Esta ronda',
    reviewEmpty: 'Aún no hay platos gratis en esta ronda',
    reviewOwnBlock: 'Yo',
    guidanceStepJoin: 'En ronda',
    guidanceStepSend: 'Enviar',
    guidanceStepSent: 'Enviado',
    guidanceUnsent: 'La cocina aún no lo recibió · {qty} en esta ronda',
    guidanceFull: 'Ronda llena ({qty}/{cap}) · envíala primero',
    guidanceCountdown: 'Envío automático en {seconds}s · la mesa aún puede pedir',
    guidanceFailed: 'Envío fallido, reintentando · avisa al personal si sigue',
    guidanceSent: 'Enviado · de pago OK · siguiente ronda gratis en {seconds}s',
    goToSend: 'Enviar · {count}',
    reviewNotYet: 'Aún no',
    addToRound: 'Añadir a la ronda',
    placeOrderAndRound: 'Pedir + añadir a ronda',
    placedInRound: 'En la ronda · aún no enviado',
    placedMixed: 'De pago enviados · gratis en la ronda',
    reviewPaidSentTitle: 'Platos de pago · ya enviados',
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
    cooldownActive: 'Gratis esperan la siguiente ronda — de pago OK ahora',
    emptyRound: 'Añade platos gratis primero',
    guestClientLimit: 'Esta mesa alcanzó el límite de móviles — pide al personal que haga el pedido',
    submitFailed: 'Algo falló — reintenta',
    introTitle: 'Rondas de sushi en la mesa',
    introSubtitle: 'Los platos gratis entran en la ronda, pero cocina empieza solo tras “Enviar”; los de pago van ya',
    introStep1Title: 'Añadir a la ronda',
    introStep1Body: 'Pon los platos gratis en el carrito (con notas) y toca “Añadir a la ronda” — la mesa comparte la ronda.',
    introStep2Title: 'Enviar',
    introStep2Body: 'Cuando la barra diga que cocina aún no lo recibió, toca “Enviar” y luego “Enviar a cocina”. Una cuenta atrás corta deja a la mesa añadir más.',
    introStep3Title: 'Siguiente ronda',
    introStep3Body:
      'Tras enviar, la barra cuenta; de pago siguen disponibles, gratis esperan la siguiente ronda.',
    introCta: 'Empezar a pedir',
  },
  fr: {
    stickyRoundCapHint: 'max {cap}',
    stickyRoundProgress: 'round {qty}/{cap}',
    sendRound: 'Send to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    reviewOwnBlock: 'You',
    guidanceStepJoin: 'In round',
    guidanceStepSend: 'Send',
    guidanceStepSent: 'Sent',
    guidanceUnsent: 'Kitchen hasn’t got these yet · {qty} in this round',
    guidanceFull: 'Round full ({qty}/{cap}) · send it first',
    guidanceCountdown: 'Auto-send in {seconds}s · table can still add',
    guidanceFailed: 'Send failed, retrying · ask staff if it persists',
    guidanceSent: 'Sent · paid dishes OK · next free round in {seconds}s',
    goToSend: 'Send · {count}',
    reviewNotYet: 'Not yet',
    addToRound: 'Add to round',
    placeOrderAndRound: 'Order + add to round',
    placedInRound: 'Added to round · not sent yet',
    placedMixed: 'Paid dishes sent · free dishes added to round',
    reviewPaidSentTitle: 'Paid dishes · already sent',
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
    cooldownActive: 'Free dishes wait for next round — paid dishes OK now',
    emptyRound: 'Add free dishes first',
    guestClientLimit: 'This table has reached its phone limit — please ask staff to order for you',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Free dishes join this round, but the kitchen starts only after “Send”; paid dishes go straight away',
    introStep1Title: 'Add to round',
    introStep1Body: 'Put free dishes in your cart (notes OK) and tap “Add to round” — the table shares one round.',
    introStep2Title: 'Send',
    introStep2Body: 'When the bar says the kitchen hasn’t got them, tap “Send”, then “Send to kitchen”. A short countdown lets the table add more.',
    introStep3Title: 'Next round',
    introStep3Body:
      'After sending, the bar counts down; paid dishes stay available, free dishes wait for the next round.',
    introCta: 'Start ordering',
  },
  de: {
    stickyRoundCapHint: 'max {cap}',
    stickyRoundProgress: 'round {qty}/{cap}',
    sendRound: 'Send to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    reviewOwnBlock: 'You',
    guidanceStepJoin: 'In round',
    guidanceStepSend: 'Send',
    guidanceStepSent: 'Sent',
    guidanceUnsent: 'Kitchen hasn’t got these yet · {qty} in this round',
    guidanceFull: 'Round full ({qty}/{cap}) · send it first',
    guidanceCountdown: 'Auto-send in {seconds}s · table can still add',
    guidanceFailed: 'Send failed, retrying · ask staff if it persists',
    guidanceSent: 'Sent · paid dishes OK · next free round in {seconds}s',
    goToSend: 'Send · {count}',
    reviewNotYet: 'Not yet',
    addToRound: 'Add to round',
    placeOrderAndRound: 'Order + add to round',
    placedInRound: 'Added to round · not sent yet',
    placedMixed: 'Paid dishes sent · free dishes added to round',
    reviewPaidSentTitle: 'Paid dishes · already sent',
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
    cooldownActive: 'Free dishes wait for next round — paid dishes OK now',
    emptyRound: 'Add free dishes first',
    guestClientLimit: 'This table has reached its phone limit — please ask staff to order for you',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Free dishes join this round, but the kitchen starts only after “Send”; paid dishes go straight away',
    introStep1Title: 'Add to round',
    introStep1Body: 'Put free dishes in your cart (notes OK) and tap “Add to round” — the table shares one round.',
    introStep2Title: 'Send',
    introStep2Body: 'When the bar says the kitchen hasn’t got them, tap “Send”, then “Send to kitchen”. A short countdown lets the table add more.',
    introStep3Title: 'Next round',
    introStep3Body:
      'After sending, the bar counts down; paid dishes stay available, free dishes wait for the next round.',
    introCta: 'Start ordering',
  },
};

type SushiRoundCopy = (typeof SUSHI_ROUND_MESSAGES)[Language];

/**
 * Sole sticky round fragment after table headcount (one slot, fixed bar height):
 * no unsent qty (incl. a sent round in cooldown) → max per round, else round qty/cap. Send state (countdown / cooldown /
 * unsent) lives only in the guidance strip — never a second status here.
 */
export function formatSushiStickyRoundLimit(input: {
  linesQtyTotal: number;
  roundCapTotal: number;
  labels: Pick<SushiRoundCopy, 'stickyRoundCapHint' | 'stickyRoundProgress'>;
}): string | null {
  const q = Number.isFinite(input.linesQtyTotal) ? Math.max(0, Math.floor(input.linesQtyTotal)) : 0;
  const c = Number.isFinite(input.roundCapTotal) ? Math.max(0, Math.floor(input.roundCapTotal)) : 0;
  if (c < 1) return null;
  if (q > 0) {
    return input.labels.stickyRoundProgress.replace('{qty}', String(q)).replace('{cap}', String(c));
  }
  return input.labels.stickyRoundCapHint.replace('{cap}', String(c));
}

/** Sole guidance message for {@link SushiSendGuidance} (strip + round review notice). */
export function formatSushiSendGuidanceMessage(guidance: SushiSendGuidance, t: SushiRoundCopy): string {
  switch (guidance.kind) {
    case 'unsent':
      return guidance.full
        ? t.guidanceFull.replace('{qty}', String(guidance.qty)).replace('{cap}', String(guidance.cap))
        : t.guidanceUnsent.replace('{qty}', String(guidance.qty));
    case 'countdown':
      return t.guidanceCountdown.replace('{seconds}', String(guidance.seconds));
    case 'failed':
      return t.guidanceFailed;
    case 'sent':
      return t.guidanceSent.replace('{seconds}', String(guidance.seconds));
  }
}

/**
 * Sole sushi cart submit label (footer draft CTA + cart drawer button): free
 * dishes only join the round, paid dishes go to the kitchen now (§2.2).
 */
export function resolveSushiCartSubmitLabel(input: {
  hasFree: boolean;
  hasPaid: boolean;
  roundT: Pick<SushiRoundCopy, 'addToRound' | 'placeOrderAndRound'>;
  placeOrder: string;
}): string {
  if (input.hasFree && input.hasPaid) return input.roundT.placeOrderAndRound;
  if (input.hasFree) return input.roundT.addToRound;
  return input.placeOrder;
}

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
    case 'guest_client_limit':
      return t.guestClientLimit;
    default:
      return t.submitFailed;
  }
}

/** Sole toast copy for guest local free-qty preview (card +/- / 下单 / 核单). */
export function messageForGuestRoundQtyPreview(
  gate: Extract<GuestRoundQtyPreviewResult, { ok: false }>,
  roundT: (typeof SUSHI_ROUND_MESSAGES)[Language],
  menuT: (typeof MENU_PAGE_MESSAGES)[Language],
): string {
  if (gate.error === 'round_cap_exceeded') {
    return messageForSushiRoundError('round_cap_exceeded', roundT, {
      used: gate.used,
      cap: gate.cap,
    });
  }
  return messageForSushiLimitError(gate.error, menuT);
}
