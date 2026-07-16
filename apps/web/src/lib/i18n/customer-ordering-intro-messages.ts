import type { UILanguage } from '@/lib/i18n';

export type CustomerOrderingIntroStepCopy = {
  title: string;
  body: string;
};

export type CustomerOrderingIntroCopy = {
  title: string;
  subtitle: string;
  /** Order → view bill → split → call checkout */
  steps: [
    CustomerOrderingIntroStepCopy,
    CustomerOrderingIntroStepCopy,
    CustomerOrderingIntroStepCopy,
    CustomerOrderingIntroStepCopy,
  ];
  cta: string;
  footnote: string;
};

/** Index of the split step (shows the split UI preview). */
export const CUSTOMER_ORDERING_INTRO_SPLIT_STEP_INDEX = 2;

export const CUSTOMER_ORDERING_INTRO_MESSAGES: Record<UILanguage, CustomerOrderingIntroCopy> = {
  pt: {
    title: 'Bem-vindo ao Mesa',
    subtitle: 'Quatro passos simples para pedir e pagar',
    steps: [
      {
        title: 'Pedir',
        body: 'Veja o menu, adicione ao carrinho e envie o pedido',
      },
      {
        title: 'Ver conta',
        body: 'Toque em «Ver conta» na barra inferior para abrir a página da conta',
      },
      {
        title: 'Dividir a conta',
        body: 'Escolha como partilhar: igual, por prato ou personalizado',
      },
      {
        title: 'Chamar fechamento',
        body: 'Peça o fecho e leve o telemóvel ao balcão para pagar',
      },
    ],
    cta: 'Começar a pedir',
    footnote: 'Mostrado apenas uma vez',
  },
  en: {
    title: 'Welcome to Mesa ordering',
    subtitle: 'Four simple steps to order and pay',
    steps: [
      {
        title: 'Order',
        body: 'Browse the menu, add to cart, and submit',
      },
      {
        title: 'View bill',
        body: 'Tap "View bill" on the bottom bar to open the bill page',
      },
      {
        title: 'Split the bill',
        body: 'Choose how to share: even, by item, or custom',
      },
      {
        title: 'Call for the bill',
        body: 'Request checkout, then bring your phone to the counter to pay',
      },
    ],
    cta: 'Start ordering',
    footnote: 'Shown once only',
  },
  zh: {
    title: '欢迎使用 Mesa 点餐',
    subtitle: '简单四步，轻松用餐',
    steps: [
      {
        title: '选菜下单',
        body: '浏览菜单，加入购物车并提交',
      },
      {
        title: '查看账单',
        body: '点底栏「查看账单」进入账单页',
      },
      {
        title: '分单',
        body: '选择均摊、按菜或自定义，把账单分给同行',
      },
      {
        title: '呼叫结账',
        body: '呼叫结账后，携带手机上的分单信息到前台付款',
      },
    ],
    cta: '开始点餐',
    footnote: '此提示仅显示一次',
  },
};
