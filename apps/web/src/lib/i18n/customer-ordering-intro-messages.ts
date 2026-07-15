import type { UILanguage } from '@/lib/i18n';

export type CustomerOrderingIntroCopy = {
  title: string;
  subtitle: string;
  stepOrderTitle: string;
  stepOrderBody: string;
  stepSplitTitle: string;
  stepSplitBody: string;
  stepCheckoutTitle: string;
  stepCheckoutBody: string;
  cta: string;
  footnote: string;
  previewGuest1: string;
  previewGuest2: string;
};

export const CUSTOMER_ORDERING_INTRO_MESSAGES: Record<UILanguage, CustomerOrderingIntroCopy> = {
  pt: {
    title: 'Bem-vindo ao Mesa',
    subtitle: 'Três passos simples para pedir e pagar',
    stepOrderTitle: 'Pedir',
    stepOrderBody: 'Veja o menu, adicione ao carrinho e envie o pedido',
    stepSplitTitle: 'Dividir a conta',
    stepSplitBody: 'Toque em «Ver conta» para abrir a pagina da conta',
    stepCheckoutTitle: 'Chamar fechamento',
    stepCheckoutBody: 'Leve o telemóvel ao balcão para pagar',
    cta: 'Começar a pedir',
    footnote: 'Mostrado apenas uma vez',
    previewGuest1: 'Pessoa 1',
    previewGuest2: 'Pessoa 2',
  },
  en: {
    title: 'Welcome to Mesa ordering',
    subtitle: 'Three simple steps to order and pay',
    stepOrderTitle: 'Order',
    stepOrderBody: 'Browse the menu, add to cart, and submit',
    stepSplitTitle: 'Split the bill',
    stepSplitBody: 'Tap "View bill" to open the bill page',
    stepCheckoutTitle: 'Call for the bill',
    stepCheckoutBody: 'Bring your phone to the counter to pay',
    cta: 'Start ordering',
    footnote: 'Shown once only',
    previewGuest1: 'Guest 1',
    previewGuest2: 'Guest 2',
  },
  zh: {
    title: '欢迎使用 Mesa 点餐',
    subtitle: '简单三步，轻松用餐',
    stepOrderTitle: '选菜下单',
    stepOrderBody: '浏览菜单，加入购物车并提交',
    stepSplitTitle: '分单结账',
    stepSplitBody: '点「查看账单」进入账单页',
    stepCheckoutTitle: '呼叫结账',
    stepCheckoutBody: '携带手机上的分单信息到前台付款',
    cta: '开始点餐',
    footnote: '此提示仅显示一次',
    previewGuest1: '客人 1',
    previewGuest2: '客人 2',
  },
};
