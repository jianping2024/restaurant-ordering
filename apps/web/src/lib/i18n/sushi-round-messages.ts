import type { Language } from '@/types';

/** Customer sushi-round UI copy (zh / en / pt). */
export const SUSHI_ROUND_MESSAGES: Record<
  Language,
  {
    stickyGuestsCap: string;
    stickyRoundProgress: string;
    stickyCooldown: string;
    stickyDeferCooldown: string;
    stickyPending: string;
    sendRound: string;
    viewRoundReview: string;
    roundReviewCount: string;
    reviewTitle: string;
    reviewEmpty: string;
    placedInRound: string;
    confirmTitle: string;
    confirmMessage: string;
    confirmAction: string;
    deferAction: string;
    deferConfirmTitle: string;
    deferConfirmMessage: string;
    deferConfirmYes: string;
    deferConfirmNo: string;
    deferredToast: string;
    sentToast: string;
    roundCapExceeded: string;
    basketLocked: string;
    cooldownActive: string;
    deferCooldown: string;
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
    stickyGuestsCap: '本桌 {guests} 人 · 每轮免费菜最多 {cap} 份',
    stickyRoundProgress: '本轮 {qty}/{cap}',
    stickyCooldown: '桌级冷却 {seconds}s',
    stickyDeferCooldown: '暂缓冷却 {seconds}s',
    stickyPending: '确认中 {confirmed}/{quorum} · {seconds}s',
    sendRound: '送厨本轮',
    viewRoundReview: '本轮核单',
    roundReviewCount: '本轮核单 ({count})',
    reviewTitle: '本轮核单',
    reviewEmpty: '还没有已下单的免费菜',
    placedInRound: '已加入本轮核单',
    confirmTitle: '确认送厨本轮？',
    confirmMessage: '同桌需确认后才会送厨；超时未投票视为同意。',
    confirmAction: '确认送厨',
    deferAction: '暂缓送厨',
    deferConfirmTitle: '确定暂缓送厨？',
    deferConfirmMessage: '同桌需重新发起送厨；本轮仅可暂缓一次。',
    deferConfirmYes: '确定暂缓',
    deferConfirmNo: '返回',
    deferredToast: '有人暂缓了本次送厨',
    sentToast: '本轮已送厨',
    roundCapExceeded: '已达本轮免费菜上限',
    basketLocked: '确认中，暂不可改免费菜',
    cooldownActive: '送厨冷却中，请稍候',
    deferCooldown: '暂缓冷却中，请稍候再发起',
    emptyRound: '请先添加免费菜',
    submitFailed: '操作失败，请重试',
    introTitle: '寿司同桌轮次',
    introSubtitle: '免费菜先下单进本轮，核单后送厨；收费菜即时下单',
    introStep1Title: '加菜下单',
    introStep1Body: '免费菜进购物车，可写备注，点下单后进入本轮核单。',
    introStep2Title: '本轮核单',
    introStep2Body: '只看自己已下的免费菜；顶栏数量是整桌合计。',
    introStep3Title: '送厨确认',
    introStep3Body: '从核单发起送厨，同桌确认或超时默认同意。',
    introCta: '开始点餐',
  },
  en: {
    stickyGuestsCap: '{guests} guests · up to {cap} free dishes per round',
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyDeferCooldown: 'Defer cooldown {seconds}s',
    stickyPending: 'Confirming {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Send round to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    placedInRound: 'Added to this round',
    confirmTitle: 'Send this round to kitchen?',
    confirmMessage: 'Everyone at the table must confirm; no vote by the deadline counts as yes.',
    confirmAction: 'Confirm',
    deferAction: 'Defer',
    deferConfirmTitle: 'Defer sending?',
    deferConfirmMessage: 'The table must request send again. Only one defer per round.',
    deferConfirmYes: 'Defer',
    deferConfirmNo: 'Back',
    deferredToast: 'Someone deferred this send',
    sentToast: 'Round sent to kitchen',
    roundCapExceeded: 'Round free-dish cap reached',
    basketLocked: 'Confirming — free dishes are locked',
    cooldownActive: 'Table cooldown — please wait',
    deferCooldown: 'Defer cooldown — try again shortly',
    emptyRound: 'Add free dishes first',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Place free dishes into this round, review, then send; paid dishes go now',
    introStep1Title: 'Add and place',
    introStep1Body: 'Free dishes go in your cart with notes. Place order to add them to this round.',
    introStep2Title: 'This round',
    introStep2Body: 'You only see your own unsent free dishes. The top bar shows the table total.',
    introStep3Title: 'Send to kitchen',
    introStep3Body: 'Send from this-round review; the table confirms or timeout agrees.',
    introCta: 'Start ordering',
  },
  pt: {
    stickyGuestsCap: '{guests} pessoas · ate {cap} pratos gratis por ronda',
    stickyRoundProgress: 'Ronda {qty}/{cap}',
    stickyCooldown: 'Arrefecimento da mesa {seconds}s',
    stickyDeferCooldown: 'Arrefecimento apos adiar {seconds}s',
    stickyPending: 'A confirmar {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Enviar ronda a cozinha',
    viewRoundReview: 'Esta ronda',
    roundReviewCount: 'Esta ronda ({count})',
    reviewTitle: 'Esta ronda',
    reviewEmpty: 'Ainda nao ha pratos gratis nesta ronda',
    placedInRound: 'Adicionado a esta ronda',
    confirmTitle: 'Enviar esta ronda a cozinha?',
    confirmMessage: 'A mesa confirma; sem voto ate ao prazo conta como sim.',
    confirmAction: 'Confirmar',
    deferAction: 'Adiar',
    deferConfirmTitle: 'Adiar o envio?',
    deferConfirmMessage: 'A mesa tem de pedir de novo. So um adiar por ronda.',
    deferConfirmYes: 'Adiar',
    deferConfirmNo: 'Voltar',
    deferredToast: 'Alguem adiou este envio',
    sentToast: 'Ronda enviada a cozinha',
    roundCapExceeded: 'Limite de pratos gratis da ronda atingido',
    basketLocked: 'Em confirmacao — pratos gratis bloqueados',
    cooldownActive: 'Arrefecimento da mesa — aguarde',
    deferCooldown: 'Arrefecimento apos adiar — tente em breve',
    emptyRound: 'Adicione pratos gratis primeiro',
    submitFailed: 'Falhou — tente de novo',
    introTitle: 'Rondas de sushi na mesa',
    introSubtitle: 'Pratos gratis vao primeiro ao cesto, depois a ronda; pagos pedem ja',
    introStep1Title: 'Adicionar e enviar',
    introStep1Body: 'Pratos gratis entram no carrinho, com nota. Enviar pedido mete-os nesta ronda.',
    introStep2Title: 'Esta ronda',
    introStep2Body: 'So ve os seus pratos gratis ainda nao enviados. A barra de cima mostra o total da mesa.',
    introStep3Title: 'Enviar a cozinha',
    introStep3Body: 'Peca o envio nesta ronda; a mesa confirma ou o prazo conta como sim.',
    introCta: 'Comecar a pedir',
  },
  es: {
    stickyGuestsCap: '{guests} guests · up to {cap} free dishes per round',
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyDeferCooldown: 'Defer cooldown {seconds}s',
    stickyPending: 'Confirming {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Send round to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    placedInRound: 'Added to this round',
    confirmTitle: 'Send this round to kitchen?',
    confirmMessage: 'Everyone at the table must confirm; no vote by the deadline counts as yes.',
    confirmAction: 'Confirm',
    deferAction: 'Defer',
    deferConfirmTitle: 'Defer sending?',
    deferConfirmMessage: 'The table must request send again. Only one defer per round.',
    deferConfirmYes: 'Defer',
    deferConfirmNo: 'Back',
    deferredToast: 'Someone deferred this send',
    sentToast: 'Round sent to kitchen',
    roundCapExceeded: 'Round free-dish cap reached',
    basketLocked: 'Confirming — free dishes are locked',
    cooldownActive: 'Table cooldown — please wait',
    deferCooldown: 'Defer cooldown — try again shortly',
    emptyRound: 'Add free dishes first',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Place free dishes into this round, review, then send; paid dishes go now',
    introStep1Title: 'Add and place',
    introStep1Body: 'Free dishes go in your cart with notes. Place order to add them to this round.',
    introStep2Title: 'This round',
    introStep2Body: 'You only see your own unsent free dishes. The top bar shows the table total.',
    introStep3Title: 'Send to kitchen',
    introStep3Body: 'Send from this-round review; the table confirms or timeout agrees.',
    introCta: 'Start ordering',
  },
  fr: {
    stickyGuestsCap: '{guests} guests · up to {cap} free dishes per round',
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyDeferCooldown: 'Defer cooldown {seconds}s',
    stickyPending: 'Confirming {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Send round to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    placedInRound: 'Added to this round',
    confirmTitle: 'Send this round to kitchen?',
    confirmMessage: 'Everyone at the table must confirm; no vote by the deadline counts as yes.',
    confirmAction: 'Confirm',
    deferAction: 'Defer',
    deferConfirmTitle: 'Defer sending?',
    deferConfirmMessage: 'The table must request send again. Only one defer per round.',
    deferConfirmYes: 'Defer',
    deferConfirmNo: 'Back',
    deferredToast: 'Someone deferred this send',
    sentToast: 'Round sent to kitchen',
    roundCapExceeded: 'Round free-dish cap reached',
    basketLocked: 'Confirming — free dishes are locked',
    cooldownActive: 'Table cooldown — please wait',
    deferCooldown: 'Defer cooldown — try again shortly',
    emptyRound: 'Add free dishes first',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Place free dishes into this round, review, then send; paid dishes go now',
    introStep1Title: 'Add and place',
    introStep1Body: 'Free dishes go in your cart with notes. Place order to add them to this round.',
    introStep2Title: 'This round',
    introStep2Body: 'You only see your own unsent free dishes. The top bar shows the table total.',
    introStep3Title: 'Send to kitchen',
    introStep3Body: 'Send from this-round review; the table confirms or timeout agrees.',
    introCta: 'Start ordering',
  },
  de: {
    stickyGuestsCap: '{guests} guests · up to {cap} free dishes per round',
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyDeferCooldown: 'Defer cooldown {seconds}s',
    stickyPending: 'Confirming {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Send round to kitchen',
    viewRoundReview: 'This round',
    roundReviewCount: 'This round ({count})',
    reviewTitle: 'This round',
    reviewEmpty: 'No free dishes placed this round yet',
    placedInRound: 'Added to this round',
    confirmTitle: 'Send this round to kitchen?',
    confirmMessage: 'Everyone at the table must confirm; no vote by the deadline counts as yes.',
    confirmAction: 'Confirm',
    deferAction: 'Defer',
    deferConfirmTitle: 'Defer sending?',
    deferConfirmMessage: 'The table must request send again. Only one defer per round.',
    deferConfirmYes: 'Defer',
    deferConfirmNo: 'Back',
    deferredToast: 'Someone deferred this send',
    sentToast: 'Round sent to kitchen',
    roundCapExceeded: 'Round free-dish cap reached',
    basketLocked: 'Confirming — free dishes are locked',
    cooldownActive: 'Table cooldown — please wait',
    deferCooldown: 'Defer cooldown — try again shortly',
    emptyRound: 'Add free dishes first',
    submitFailed: 'Something went wrong — retry',
    introTitle: 'Sushi table rounds',
    introSubtitle: 'Place free dishes into this round, review, then send; paid dishes go now',
    introStep1Title: 'Add and place',
    introStep1Body: 'Free dishes go in your cart with notes. Place order to add them to this round.',
    introStep2Title: 'This round',
    introStep2Body: 'You only see your own unsent free dishes. The top bar shows the table total.',
    introStep3Title: 'Send to kitchen',
    introStep3Body: 'Send from this-round review; the table confirms or timeout agrees.',
    introCta: 'Start ordering',
  },
};

export function messageForSushiRoundError(
  code: string | undefined,
  t: (typeof SUSHI_ROUND_MESSAGES)[Language],
): string {
  switch (code) {
    case 'round_cap_exceeded':
      return t.roundCapExceeded;
    case 'round_basket_locked':
      return t.basketLocked;
    case 'round_cooldown_active':
      return t.cooldownActive;
    case 'round_defer_cooldown':
      return t.deferCooldown;
    case 'round_empty':
      return t.emptyRound;
    default:
      return t.submitFailed;
  }
}
