import type { UILanguage } from '@/lib/i18n';
import type { LandingPreviewScreenId } from '@/lib/landing/preview-screens';

export type LandingNavItem = {
  id: string;
  href: string;
  label: string;
};

export type LandingPainPoint = {
  title: string;
  problem: string;
  solution: string;
};

export type LandingBuffetFeature = {
  title: string;
  desc: string;
};

export type LandingSupportFeature = {
  title: string;
  desc: string;
};

export type LandingOnboardingStep = {
  title: string;
  desc: string;
};

export type LandingPreviewScreen = {
  id: LandingPreviewScreenId;
  label: string;
  caption: string;
};

export type LandingCopy = {
  nav: {
    solutions: string;
    preview: string;
    caseStudy: string;
    contact: string;
    login: string;
  };
  hero: {
    tag: string;
    titleA: string;
    titleB: string;
    desc: string;
    whatsappCta: string;
    wechatCta: string;
    previewHint: string;
  };
  pain: {
    title: string;
    items: LandingPainPoint[];
  };
  buffet: {
    title: string;
    subtitle: string;
    items: LandingBuffetFeature[];
  };
  support: {
    title: string;
    items: LandingSupportFeature[];
  };
  preview: {
    title: string;
    subtitle: string;
    remoteDemo: string;
    screens: LandingPreviewScreen[];
  };
  caseStudy: {
    title: string;
    name: string;
    location: string;
    quote: string;
    tags: string[];
  };
  contact: {
    title: string;
    subtitle: string;
    pricingNote: string;
    whatsappLabel: string;
    wechatLabel: string;
    wechatScanHint: string;
    wechatCopy: string;
    wechatCopied: string;
    stepsTitle: string;
    steps: LandingOnboardingStep[];
  };
  footer: {
    login: string;
    copyright: string;
  };
};

export type LandingLanguage = UILanguage;

/** UI chrome inside landing product mock screens (separate from marketing LandingCopy). */
export type LandingPreviewCopy = {
  chrome: {
    banner: string;
  };
  shared: {
    /** Use `{name}` for table display name. */
    tableLabel: string;
    restaurantName: string;
  };
  waiterOpen: {
    roleHint: string;
    diningStatus: string;
    buffetName: string;
    adultsLabel: string;
    childrenLabel: string;
    adultPriceLabel: string;
    childPriceLabel: string;
    estimatedTotalLabel: string;
    confirmOpen: string;
  };
  menu: {
    /** Use `{outlet}` for production counter name. */
    subtitle: string;
    outletBar: string;
    categories: {
      drinks: string;
      'fruit-wine': string;
    };
    /** Use `{count}` for cart line count. */
    cartSummary: string;
    submitOrder: string;
  };
  bar: {
    title: string;
    subtitle: string;
    status: {
      pending: string;
      preparing: string;
    };
    doneBadge: string;
    /** Use `{name}` and `{qty}`. */
    lineQty: string;
  };
  bill: {
    /** Appended after table label, e.g. " · Checkout". */
    frameSuffix: string;
    title: string;
    subtitle: string;
    buffetFee: string;
    drinksTotal: string;
    grandTotal: string;
    splitModeTitle: string;
    splitModes: [string, string, string];
    /** Use `{guests}` and `{avg}`. */
    perGuestSummary: string;
    confirmPayment: string;
  };
  dashboard: {
    title: string;
    todayOrders: string;
    todayRevenue: string;
    topDrinksTitle: string;
    drinkColumn: string;
    qtyColumn: string;
  };
};
