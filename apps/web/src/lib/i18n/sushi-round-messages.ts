import type { Language } from '@/types';
import type { GuestRoundQtyPreviewResult } from '@/lib/table-order-round/round-meal-limit';
import { isCooldownActive } from '@/lib/table-order-round/status';
import { messageForSushiLimitError, MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

/** Customer sushi-round UI copy (zh / en / pt). Countdown send — no vote/defer. */
export const SUSHI_ROUND_MESSAGES: Record<
  Language,
  {
    /** Empty round sticky slot: max-per-round short hint (cap = round_cap_total). */
    stickyRoundCapHint: string;
    /** Collecting with lines sticky slot: qty/cap. */
    stickyRoundProgress: string;
    /** Active cooldown sticky slot (short). */
    stickyCooldown: string;
    /** pending_confirm sticky slot (short; long copy stays on reviewCountdownBanner). */
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
    stickyRoundCapHint: '每轮最多 {cap}',
    stickyRoundProgress: '{qty}/{cap}',
    stickyCooldown: '冷却 {seconds}s',
    stickyPending: '{seconds}s 后送厨',
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
    stickyRoundCapHint: 'max {cap}/round',
    stickyRoundProgress: '{qty}/{cap}',
    stickyCooldown: 'wait {seconds}s',
    stickyPending: 'kitchen in {seconds}s',
    sendRound: 'Send to kitchen',
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
    stickyRoundCapHint: 'máx. {cap}/ronda',
    stickyRoundProgress: '{qty}/{cap}',
    stickyCooldown: 'espera {seconds}s',
    stickyPending: 'cozinha em {seconds}s',
    sendRound: 'Enviar à cozinha',
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
    stickyRoundCapHint: 'máx. {cap}/ronda',
    stickyRoundProgress: '{qty}/{cap}',
    stickyCooldown: 'espera {seconds}s',
    stickyPending: 'cocina en {seconds}s',
    sendRound: 'Enviar a cocina',
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
    stickyRoundCapHint: 'max {cap}/round',
    stickyRoundProgress: '{qty}/{cap}',
    stickyCooldown: 'wait {seconds}s',
    stickyPending: 'kitchen in {seconds}s',
    sendRound: 'Send to kitchen',
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
    stickyRoundCapHint: 'max {cap}/round',
    stickyRoundProgress: '{qty}/{cap}',
    stickyCooldown: 'wait {seconds}s',
    stickyPending: 'kitchen in {seconds}s',
    sendRound: 'Send to kitchen',
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

/**
 * Sole sticky status fragment after table headcount (one slot, fixed bar height).
 * Priority: pending_confirm countdown → active cooldown → round limit/progress.
 * Never a second sticky row beside this string.
 */
export function resolveSushiStickyStatusFragment(input: {
  status: string | null | undefined;
  cooldownUntil: string | null | undefined;
  submitDeadlineAt: string | null | undefined;
  linesQtyTotal: number;
  roundCapTotal: number;
  labels: Pick<
    (typeof SUSHI_ROUND_MESSAGES)[Language],
    'stickyRoundCapHint' | 'stickyRoundProgress' | 'stickyCooldown' | 'stickyPending'
  >;
  nowMs?: number;
}): { text: string; kind: 'pending' | 'cooldown' | 'limit' } | null {
  const nowMs = input.nowMs ?? Date.now();
  const labels = input.labels;

  if (input.status === 'pending_confirm') {
    return {
      kind: 'pending',
      text: labels.stickyPending.replace(
        '{seconds}',
        String(secondsUntilIso(input.submitDeadlineAt, nowMs)),
      ),
    };
  }

  if (input.status === 'cooldown' && isCooldownActive('cooldown', input.cooldownUntil ?? null, nowMs)) {
    return {
      kind: 'cooldown',
      text: labels.stickyCooldown.replace(
        '{seconds}',
        String(secondsUntilIso(input.cooldownUntil, nowMs)),
      ),
    };
  }

  const limit = formatSushiStickyRoundLimitLabel(
    input.linesQtyTotal,
    input.roundCapTotal,
    labels,
  );
  if (!limit) return null;
  return { kind: 'limit', text: limit };
}

function secondsUntilIso(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return 0;
  const until = Date.parse(iso);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, Math.ceil((until - nowMs) / 1000));
}

/** Round-limit fragment only (used by resolveSushiStickyStatusFragment). */
function formatSushiStickyRoundLimitLabel(
  qty: number,
  cap: number,
  labels: Pick<(typeof SUSHI_ROUND_MESSAGES)[Language], 'stickyRoundCapHint' | 'stickyRoundProgress'>,
): string | null {
  const q = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
  const c = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0;
  if (c < 1) return null;
  if (q > 0) {
    return labels.stickyRoundProgress.replace('{qty}', String(q)).replace('{cap}', String(c));
  }
  return labels.stickyRoundCapHint.replace('{cap}', String(c));
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
