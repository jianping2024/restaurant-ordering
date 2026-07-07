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
