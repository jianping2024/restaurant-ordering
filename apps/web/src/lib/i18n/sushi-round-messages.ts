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
    /** Round-review primary CTA while sendable; {count} = table unsent qty. */
    sendRoundCount: string;
    /** Footer CTA → round review when nothing waits for the guest to send. */
    viewRoundReview: string;
    roundReviewCount: string;
    reviewTitle: string;
    /** Sendable round-review hero title (same sheet; not a second modal). */
    reviewHeroTitle: string;
    /** Sendable round-review hero lead; {qty} = table unsent qty. */
    reviewHeroLead: string;
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
    /** Round review dismiss while sendable (再加点). */
    reviewAddMore: string;
    /** Cart submit: free dishes only. */
    addToRound: string;
    /** Cart submit: paid dishes (sent now) + free dishes (join round). */
    placeOrderAndRound: string;
    placedInRound: string;
    /** Mixed cart submit: paid sent now + free joined round. */
    placedMixed: string;
    /** Ephemeral tip after this submit included paid dishes; {count} = paid qty. */
    reviewPaidJustOrdered: string;
    /** Round review read-only section: paid dishes already sent this round. */
    reviewPaidSentTitle: string;
    /** Use {count} = table unsent qty. */
    confirmTitle: string;
    /** Use {confirm} = countdown seconds; {cooldown} = table cooldown seconds. */
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
    sendRoundCount: '送厨 · {count} 道',
    viewRoundReview: '查看本轮',
    roundReviewCount: '本轮核单 ({count})',
    reviewTitle: '本轮核单',
    reviewHeroTitle: '还差一步！',
    reviewHeroLead: '本桌 {qty} 道还没送厨，点送厨才开始做',
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
    reviewAddMore: '再加点',
    addToRound: '加入本轮',
    placeOrderAndRound: '下单并加入本轮',
    placedInRound: '已加入本轮 · 还没送厨',
    placedMixed: '收费菜已送厨 · 免费菜已加入本轮',
    reviewPaidJustOrdered: '✓ 收费菜 {count} 份已下单',
    reviewPaidSentTitle: '收费菜 · 已直接送厨',
    confirmTitle: '送厨这 {count} 道？',
    confirmMessage: '同桌点好了吗？{confirm} 秒后送出，之后 {cooldown} 秒内不能点免费菜。',
    confirmAction: '确认送厨',
    confirmCancel: '再看看',
    peerNotifyTitle: '同桌已发起送厨',
    peerNotifyMessage: '约 {n} 秒后送厨，想加点抓紧',
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
    introSubtitle: '免费菜要「送厨」厨房才做；收费菜下单即送',
    introStep1Title: '加入本轮',
    introStep1Body: '免费菜放进购物车，点「加入本轮」；同桌共用这一轮。',
    introStep2Title: '送厨',
    introStep2Body: '底部提示未送厨时，点「去送厨」→「送厨 · N」；倒计时结束自动送出。',
    introStep3Title: '下一轮',
    introStep3Body: '送厨后有冷却；收费菜可继续点，免费菜等下一轮。',
    introCta: '开始点餐',
  },
  en: {
    stickyRoundCapHint: 'max {cap}',
    stickyRoundProgress: 'round {qty}/{cap}',
    sendRound: 'Send round',
    sendRoundCount: 'Send · {count}',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewHeroTitle: 'One more step!',
    reviewHeroLead: '{qty} not sent yet — tap Send to start cooking',
    reviewEmpty: 'No free dishes in this round yet',
    reviewOwnBlock: 'You',
    guidanceStepJoin: 'In round',
    guidanceStepSend: 'Send',
    guidanceStepSent: 'Sent',
    guidanceUnsent: '{qty} not sent to kitchen yet',
    guidanceFull: 'Round full ({qty}/{cap}) — send first',
    guidanceCountdown: 'Sends in {seconds}s · table can still add',
    guidanceFailed: 'Send failed — retrying · ask staff if stuck',
    guidanceSent: 'Sent · paid OK · next free round in {seconds}s',
    goToSend: 'Send · {count}',
    reviewAddMore: 'Add more',
    addToRound: 'Add to round',
    placeOrderAndRound: 'Order + add to round',
    placedInRound: 'In round · not sent yet',
    placedMixed: 'Paid sent · free added to round',
    reviewPaidJustOrdered: '✓ {count} paid ordered',
    reviewPaidSentTitle: 'Paid · already sent',
    confirmTitle: 'Send these {count}?',
    confirmMessage: 'Table ready? Sends in {confirm}s · no free dishes for {cooldown}s.',
    confirmAction: 'Confirm',
    confirmCancel: 'Back',
    peerNotifyTitle: 'Someone started send',
    peerNotifyMessage: 'Kitchen send in about {n}s — add now if needed.',
    peerNotifyAction: 'OK',
    sentToast: 'Round sent',
    guestCountRequired: 'Ask staff to set guest count first',
    roundCapExceeded: 'Round full ({used}/{cap}). Send from “This round” first.',
    basketLocked: 'Sending — free dishes locked',
    cooldownActive: 'Free dishes wait for next round · paid OK',
    emptyRound: 'Add free dishes first',
    guestClientLimit: 'Too many phones at this table — ask staff',
    submitFailed: 'Failed — try again',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Free dishes need “Send”; paid dishes go now',
    introStep1Title: 'Add to round',
    introStep1Body: 'Add free dishes to cart, tap “Add to round”. Table shares one round.',
    introStep2Title: 'Send',
    introStep2Body: 'When the bar says not sent, tap “Send · N” and confirm. Countdown, then auto-send.',
    introStep3Title: 'Next round',
    introStep3Body: 'After send, a short wait. Paid OK now; free dishes wait for next round.',
    introCta: 'Start ordering',
  },
  pt: {
    stickyRoundCapHint: 'máx. {cap}',
    stickyRoundProgress: 'ronda {qty}/{cap}',
    sendRound: 'Enviar ronda',
    sendRoundCount: 'Enviar · {count}',
    viewRoundReview: 'Esta ronda',
    roundReviewCount: 'Esta ronda ({count})',
    reviewTitle: 'Esta ronda',
    reviewHeroTitle: 'Falta um passo!',
    reviewHeroLead: '{qty} ainda por enviar — toque Enviar para cozinhar',
    reviewEmpty: 'Ainda sem pratos grátis nesta ronda',
    reviewOwnBlock: 'Eu',
    guidanceStepJoin: 'Na ronda',
    guidanceStepSend: 'Enviar',
    guidanceStepSent: 'Enviado',
    guidanceUnsent: '{qty} ainda não enviados à cozinha',
    guidanceFull: 'Ronda cheia ({qty}/{cap}) — envie primeiro',
    guidanceCountdown: 'Envia em {seconds}s · a mesa ainda pode pedir',
    guidanceFailed: 'Falha no envio — a repetir · chame o staff',
    guidanceSent: 'Enviado · pagos OK · próxima grátis em {seconds}s',
    goToSend: 'Enviar · {count}',
    reviewAddMore: 'Pedir mais',
    addToRound: 'Juntar à ronda',
    placeOrderAndRound: 'Pedir + juntar',
    placedInRound: 'Na ronda · ainda não enviado',
    placedMixed: 'Pagos enviados · grátis na ronda',
    reviewPaidJustOrdered: '✓ {count} pagos pedidos',
    reviewPaidSentTitle: 'Pagos · já enviados',
    confirmTitle: 'Enviar estes {count}?',
    confirmMessage: 'A mesa está pronta? Envia em {confirm}s · sem grátis por {cooldown}s.',
    confirmAction: 'Confirmar',
    confirmCancel: 'Voltar',
    peerNotifyTitle: 'Alguém iniciou o envio',
    peerNotifyMessage: 'Envio em cerca de {n}s — peça já se precisar.',
    peerNotifyAction: 'OK',
    sentToast: 'Ronda enviada',
    guestCountRequired: 'Peça ao staff para registar as pessoas',
    roundCapExceeded: 'Ronda cheia ({used}/{cap}). Envie em “Esta ronda” primeiro.',
    basketLocked: 'A enviar — grátis bloqueados',
    cooldownActive: 'Grátis na próxima ronda · pagos OK',
    emptyRound: 'Adicione pratos grátis primeiro',
    guestClientLimit: 'Demasiados telemóveis nesta mesa — peça ao staff',
    submitFailed: 'Falhou — tente de novo',
    introTitle: 'Rondas de sushi',
    introSubtitle: 'Grátis precisam de “Enviar”; pagos vão já',
    introStep1Title: 'Juntar à ronda',
    introStep1Body: 'Ponha grátis no carrinho e toque “Juntar à ronda”. A mesa partilha a ronda.',
    introStep2Title: 'Enviar',
    introStep2Body: 'Quando a barra disser por enviar, toque “Enviar · N” e confirme. Depois envia sozinho.',
    introStep3Title: 'Próxima ronda',
    introStep3Body: 'Após enviar, há espera. Pagos OK; grátis na próxima ronda.',
    introCta: 'Começar',
  },
  es: {
    stickyRoundCapHint: 'máx. {cap}',
    stickyRoundProgress: 'ronda {qty}/{cap}',
    sendRound: 'Enviar ronda',
    sendRoundCount: 'Enviar · {count}',
    viewRoundReview: 'Esta ronda',
    roundReviewCount: 'Esta ronda ({count})',
    reviewTitle: 'Esta ronda',
    reviewHeroTitle: '¡Un paso más!',
    reviewHeroLead: '{qty} sin enviar — toca Enviar para cocinar',
    reviewEmpty: 'Aún no hay platos gratis en esta ronda',
    reviewOwnBlock: 'Yo',
    guidanceStepJoin: 'En ronda',
    guidanceStepSend: 'Enviar',
    guidanceStepSent: 'Enviado',
    guidanceUnsent: '{qty} aún no enviados a cocina',
    guidanceFull: 'Ronda llena ({qty}/{cap}) — envía primero',
    guidanceCountdown: 'Envía en {seconds}s · la mesa aún puede pedir',
    guidanceFailed: 'Envío fallido — reintentando · avisa al personal',
    guidanceSent: 'Enviado · de pago OK · siguiente gratis en {seconds}s',
    goToSend: 'Enviar · {count}',
    reviewAddMore: 'Pedir más',
    addToRound: 'Añadir a ronda',
    placeOrderAndRound: 'Pedir + añadir',
    placedInRound: 'En ronda · aún no enviado',
    placedMixed: 'De pago enviados · gratis en ronda',
    reviewPaidJustOrdered: '✓ {count} de pago pedidos',
    reviewPaidSentTitle: 'De pago · ya enviados',
    confirmTitle: '¿Enviar estos {count}?',
    confirmMessage: '¿Mesa lista? Envía en {confirm}s · sin gratis por {cooldown}s.',
    confirmAction: 'Confirmar',
    confirmCancel: 'Volver',
    peerNotifyTitle: 'Alguien inició el envío',
    peerNotifyMessage: 'Envío en unos {n}s — pide ya si lo necesitas.',
    peerNotifyAction: 'OK',
    sentToast: 'Ronda enviada',
    guestCountRequired: 'Pide al personal que registre comensales',
    roundCapExceeded: 'Ronda llena ({used}/{cap}). Envía en “Esta ronda” primero.',
    basketLocked: 'Enviando — gratis bloqueados',
    cooldownActive: 'Gratis en la siguiente ronda · de pago OK',
    emptyRound: 'Añade platos gratis primero',
    guestClientLimit: 'Demasiados móviles en esta mesa — pide al personal',
    submitFailed: 'Falló — reintenta',
    introTitle: 'Rondas de sushi',
    introSubtitle: 'Gratis necesitan “Enviar”; de pago van ya',
    introStep1Title: 'Añadir a ronda',
    introStep1Body: 'Pon gratis en el carrito y toca “Añadir a ronda”. La mesa comparte la ronda.',
    introStep2Title: 'Enviar',
    introStep2Body: 'Cuando la barra diga sin enviar, toca “Enviar · N” y confirma. Luego se envía solo.',
    introStep3Title: 'Siguiente ronda',
    introStep3Body: 'Tras enviar, hay espera. De pago OK; gratis en la siguiente.',
    introCta: 'Empezar',
  },
  fr: {
    stickyRoundCapHint: 'max {cap}',
    stickyRoundProgress: 'round {qty}/{cap}',
    sendRound: 'Send round',
    sendRoundCount: 'Send · {count}',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewHeroTitle: 'One more step!',
    reviewHeroLead: '{qty} not sent yet — tap Send to start cooking',
    reviewEmpty: 'No free dishes in this round yet',
    reviewOwnBlock: 'You',
    guidanceStepJoin: 'In round',
    guidanceStepSend: 'Send',
    guidanceStepSent: 'Sent',
    guidanceUnsent: '{qty} not sent to kitchen yet',
    guidanceFull: 'Round full ({qty}/{cap}) — send first',
    guidanceCountdown: 'Sends in {seconds}s · table can still add',
    guidanceFailed: 'Send failed — retrying · ask staff if stuck',
    guidanceSent: 'Sent · paid OK · next free round in {seconds}s',
    goToSend: 'Send · {count}',
    reviewAddMore: 'Add more',
    addToRound: 'Add to round',
    placeOrderAndRound: 'Order + add to round',
    placedInRound: 'In round · not sent yet',
    placedMixed: 'Paid sent · free added to round',
    reviewPaidJustOrdered: '✓ {count} paid ordered',
    reviewPaidSentTitle: 'Paid · already sent',
    confirmTitle: 'Send these {count}?',
    confirmMessage: 'Table ready? Sends in {confirm}s · no free dishes for {cooldown}s.',
    confirmAction: 'Confirm',
    confirmCancel: 'Back',
    peerNotifyTitle: 'Someone started send',
    peerNotifyMessage: 'Kitchen send in about {n}s — add now if needed.',
    peerNotifyAction: 'OK',
    sentToast: 'Round sent',
    guestCountRequired: 'Ask staff to set guest count first',
    roundCapExceeded: 'Round full ({used}/{cap}). Send from “This round” first.',
    basketLocked: 'Sending — free dishes locked',
    cooldownActive: 'Free dishes wait for next round · paid OK',
    emptyRound: 'Add free dishes first',
    guestClientLimit: 'Too many phones at this table — ask staff',
    submitFailed: 'Failed — try again',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Free dishes need “Send”; paid dishes go now',
    introStep1Title: 'Add to round',
    introStep1Body: 'Add free dishes to cart, tap “Add to round”. Table shares one round.',
    introStep2Title: 'Send',
    introStep2Body: 'When the bar says not sent, tap “Send · N” and confirm. Countdown, then auto-send.',
    introStep3Title: 'Next round',
    introStep3Body: 'After send, a short wait. Paid OK now; free dishes wait for next round.',
    introCta: 'Start ordering',
  },
  de: {
    stickyRoundCapHint: 'max {cap}',
    stickyRoundProgress: 'round {qty}/{cap}',
    sendRound: 'Send round',
    sendRoundCount: 'Send · {count}',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewHeroTitle: 'One more step!',
    reviewHeroLead: '{qty} not sent yet — tap Send to start cooking',
    reviewEmpty: 'No free dishes in this round yet',
    reviewOwnBlock: 'You',
    guidanceStepJoin: 'In round',
    guidanceStepSend: 'Send',
    guidanceStepSent: 'Sent',
    guidanceUnsent: '{qty} not sent to kitchen yet',
    guidanceFull: 'Round full ({qty}/{cap}) — send first',
    guidanceCountdown: 'Sends in {seconds}s · table can still add',
    guidanceFailed: 'Send failed — retrying · ask staff if stuck',
    guidanceSent: 'Sent · paid OK · next free round in {seconds}s',
    goToSend: 'Send · {count}',
    reviewAddMore: 'Add more',
    addToRound: 'Add to round',
    placeOrderAndRound: 'Order + add to round',
    placedInRound: 'In round · not sent yet',
    placedMixed: 'Paid sent · free added to round',
    reviewPaidJustOrdered: '✓ {count} paid ordered',
    reviewPaidSentTitle: 'Paid · already sent',
    confirmTitle: 'Send these {count}?',
    confirmMessage: 'Table ready? Sends in {confirm}s · no free dishes for {cooldown}s.',
    confirmAction: 'Confirm',
    confirmCancel: 'Back',
    peerNotifyTitle: 'Someone started send',
    peerNotifyMessage: 'Kitchen send in about {n}s — add now if needed.',
    peerNotifyAction: 'OK',
    sentToast: 'Round sent',
    guestCountRequired: 'Ask staff to set guest count first',
    roundCapExceeded: 'Round full ({used}/{cap}). Send from “This round” first.',
    basketLocked: 'Sending — free dishes locked',
    cooldownActive: 'Free dishes wait for next round · paid OK',
    emptyRound: 'Add free dishes first',
    guestClientLimit: 'Too many phones at this table — ask staff',
    submitFailed: 'Failed — try again',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Free dishes need “Send”; paid dishes go now',
    introStep1Title: 'Add to round',
    introStep1Body: 'Add free dishes to cart, tap “Add to round”. Table shares one round.',
    introStep2Title: 'Send',
    introStep2Body: 'When the bar says not sent, tap “Send · N” and confirm. Countdown, then auto-send.',
    introStep3Title: 'Next round',
    introStep3Body: 'After send, a short wait. Paid OK now; free dishes wait for next round.',
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
