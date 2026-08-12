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
    introSubtitle: '免费菜合单确认后送厨；收费菜可单独下单',
    introStep1Title: '加免费菜',
    introStep1Body: '免费菜加入本轮合单，整桌共享额度。',
    introStep2Title: '送厨确认',
    introStep2Body: '任意客人发起后，同桌确认或超时默认同意。',
    introStep3Title: '暂缓',
    introStep3Body: '可暂缓一次；之后需重新发起送厨。',
    introCta: '开始点餐',
  },
  en: {
    stickyGuestsCap: '{guests} guests · up to {cap} free dishes per round',
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyDeferCooldown: 'Defer cooldown {seconds}s',
    stickyPending: 'Confirming {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Send round to kitchen',
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
    introSubtitle: 'Free dishes share a confirm-to-kitchen basket; paid dishes order instantly',
    introStep1Title: 'Add free dishes',
    introStep1Body: 'Free dishes join this round’s shared basket and cap.',
    introStep2Title: 'Confirm send',
    introStep2Body: 'Any guest can request send; others confirm or timeout agrees.',
    introStep3Title: 'Defer',
    introStep3Body: 'One defer per round; then someone must request send again.',
    introCta: 'Start ordering',
  },
  pt: {
    stickyGuestsCap: '{guests} pessoas · ate {cap} pratos gratis por ronda',
    stickyRoundProgress: 'Ronda {qty}/{cap}',
    stickyCooldown: 'Arrefecimento da mesa {seconds}s',
    stickyDeferCooldown: 'Arrefecimento apos adiar {seconds}s',
    stickyPending: 'A confirmar {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Enviar ronda a cozinha',
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
    introSubtitle: 'Pratos gratis partilham cesto com confirmacao; pagos pedem ja',
    introStep1Title: 'Adicionar gratis',
    introStep1Body: 'Pratos gratis entram no cesto partilhado da ronda.',
    introStep2Title: 'Confirmar envio',
    introStep2Body: 'Qualquer convidado pede envio; outros confirmam ou o prazo conta como sim.',
    introStep3Title: 'Adiar',
    introStep3Body: 'Um adiar por ronda; depois e preciso pedir envio de novo.',
    introCta: 'Comecar a pedir',
  },
  es: {
    stickyGuestsCap: '{guests} guests · up to {cap} free dishes per round',
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyDeferCooldown: 'Defer cooldown {seconds}s',
    stickyPending: 'Confirming {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Send round to kitchen',
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
    introSubtitle: 'Free dishes share a confirm-to-kitchen basket; paid dishes order instantly',
    introStep1Title: 'Add free dishes',
    introStep1Body: 'Free dishes join this round’s shared basket and cap.',
    introStep2Title: 'Confirm send',
    introStep2Body: 'Any guest can request send; others confirm or timeout agrees.',
    introStep3Title: 'Defer',
    introStep3Body: 'One defer per round; then someone must request send again.',
    introCta: 'Start ordering',
  },
  fr: {
    stickyGuestsCap: '{guests} guests · up to {cap} free dishes per round',
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyDeferCooldown: 'Defer cooldown {seconds}s',
    stickyPending: 'Confirming {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Send round to kitchen',
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
    introSubtitle: 'Free dishes share a confirm-to-kitchen basket; paid dishes order instantly',
    introStep1Title: 'Add free dishes',
    introStep1Body: 'Free dishes join this round’s shared basket and cap.',
    introStep2Title: 'Confirm send',
    introStep2Body: 'Any guest can request send; others confirm or timeout agrees.',
    introStep3Title: 'Defer',
    introStep3Body: 'One defer per round; then someone must request send again.',
    introCta: 'Start ordering',
  },
  de: {
    stickyGuestsCap: '{guests} guests · up to {cap} free dishes per round',
    stickyRoundProgress: 'This round {qty}/{cap}',
    stickyCooldown: 'Table cooldown {seconds}s',
    stickyDeferCooldown: 'Defer cooldown {seconds}s',
    stickyPending: 'Confirming {confirmed}/{quorum} · {seconds}s',
    sendRound: 'Send round to kitchen',
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
    introSubtitle: 'Free dishes share a confirm-to-kitchen basket; paid dishes order instantly',
    introStep1Title: 'Add free dishes',
    introStep1Body: 'Free dishes join this round’s shared basket and cap.',
    introStep2Title: 'Confirm send',
    introStep2Body: 'Any guest can request send; others confirm or timeout agrees.',
    introStep3Title: 'Defer',
    introStep3Body: 'One defer per round; then someone must request send again.',
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
