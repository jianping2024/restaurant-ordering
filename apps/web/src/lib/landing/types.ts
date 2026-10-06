import type { UILanguage } from '@/lib/i18n';

export type LandingPainPoint = {
  title: string;
  problem: string;
  solution: string;
};

export type LandingTextItem = {
  title: string;
  desc: string;
};

export type LandingFounder = {
  name: string;
  role: string;
  points: readonly [string, string, string];
};

export type LandingCopy = {
  nav: {
    solutions: string;
    flow: string;
    features: string;
    team: string;
    caseStudy: string;
    contact: string;
    demo: string;
    login: string;
  };
  hero: {
    tag: string;
    titleA: string;
    titleB: string;
    desc: string;
    whatsappCta: string;
    wechatCta: string;
    /** Exactly three capability chips under the primary CTAs. */
    proofs: readonly [string, string, string];
    /** Quiet channel lead before agentCta (below proofs, not between CTAs). */
    agentLead: string;
    agentCta: string;
    /** Demo-data screens drawn by `LandingHeroStage` (not real customer data). */
    stage: {
      ariaLabel: string;
      demoNote: string;
      offline: LandingTextItem;
      print: LandingTextItem;
      revenueLabel: string;
      revenueSplit: string;
      analytics: {
        nav: readonly [string, string, string, string, string, string, string];
        title: string;
        ranges: readonly [string, string, string, string, string];
        kpiRevenue: string;
        kpiGuests: string;
        kpiAvg: string;
        kpiDelta: string;
        revenueTrend: string;
        thisPeriod: string;
        lastPeriod: string;
        ranking: string;
        guestTrend: string;
        adults: string;
        children: string;
        rankNames: readonly [string, string, string, string];
      };
      phone: {
        table: string;
        restaurant: string;
        chips: readonly [string, string, string, string];
        dishes: readonly [
          { name: string; flavor: string },
          { name: string; flavor: string },
          { name: string; flavor: string },
        ];
        submit: string;
      };
    };
  };
  strip: readonly [LandingTextItem, LandingTextItem, LandingTextItem, LandingTextItem];
  /** Sole problem→solution block after the trust strip. */
  pain: {
    kicker: string;
    title: string;
    subtitle: string;
    items: readonly [
      LandingPainPoint,
      LandingPainPoint,
      LandingPainPoint,
      LandingPainPoint,
      LandingPainPoint,
    ];
  };
  flow: {
    kicker: string;
    title: string;
    subtitle: string;
    steps: readonly [LandingTextItem, LandingTextItem, LandingTextItem, LandingTextItem];
  };
  features: {
    kicker: string;
    title: string;
    subtitle: string;
    price: {
      tag: string;
      title: string;
      desc: string;
      slots: readonly [string, string, string];
    };
    language: { tag: string; title: string; desc: string };
    collab: { tag: string; title: string; desc: string };
    insights: { tag: string; title: string; desc: string };
    printing: { tag: string; title: string; desc: string };
  };
  team: {
    kicker: string;
    title: string;
    subtitle: string;
    founders: readonly [LandingFounder, LandingFounder];
    formulaTitle: string;
    formulaDesc: string;
  };
  /** Venue name/address/phone live in `LANDING_CASE_VENUE`. */
  caseStudy: {
    kicker: string;
    title: string;
    placeLine: string;
    desc: string;
    results: readonly [LandingTextItem, LandingTextItem, LandingTextItem, LandingTextItem];
    addressLabel: string;
    phoneLabel: string;
    hoursLabel: string;
    hours: string;
    tags: readonly [string, string, string, string];
    photoCaption: string;
  };
  contact: {
    kicker: string;
    title: string;
    subtitle: string;
    panelTitle: string;
    advisorsLabel: string;
    whatsappLabel: string;
    wechatLabel: string;
    wechatIdLabel: string;
    wechatScanHint: string;
    wechatCopy: string;
    wechatCopied: string;
    stepsTitle: string;
    steps: readonly [LandingTextItem, LandingTextItem, LandingTextItem, LandingTextItem];
    agent: { title: string; subtitle: string };
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
    splitModes: [string, string];
    /** Use `{guests}` and `{avg}`. */
    perGuestSummary: string;
    confirmPayment: string;
  };
  dashboard: {
    title: string;
    todayTables: string;
    todayRevenue: string;
    topDrinksTitle: string;
    drinkColumn: string;
    qtyColumn: string;
  };
};
