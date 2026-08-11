import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadJost } from "@remotion/google-fonts/Jost";

const noto = loadNotoSansSC("normal", {
  weights: ["500", "700", "900"],
  subsets: ["latin", "chinese-simplified"],
  ignoreTooManyRequestsWarning: true,
});

const cormorant = loadCormorant("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

const jost = loadJost("normal", {
  weights: ["500"],
  subsets: ["latin"],
});

export const fonts = {
  zh: noto.fontFamily,
  display: cormorant.fontFamily,
  sans: jost.fontFamily,
};

export const colors = {
  bg: "#0F0E0C",
  bgSoft: "#1A1814",
  card: "#221F1A",
  gold: "#D4A843",
  goldLight: "#E8C06A",
  goldDark: "#B8902F",
  text: "#FAF7F0",
  textMuted: "#C6BEB2",
  danger: "#E8A0A0",
  success: "#A7F3D0",
  line: "#2A2520",
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Contact channels on the CTA — from landing `lib/landing/contact.ts`. */
export type AdWeChatContact = {
  display: string;
  qrFile: string;
};

/** Quiet venue credit for proof beat — address + short intro only. */
export type ClientVenueInfo = {
  title: string;
  intro: string;
  address: string;
  hours: string;
  note: string;
};

export type AdProps = {
  contactLine: string;
  ctaLine: string;
  /** Agent-recruit headline on end beat (same contact channels). */
  agentLine: string;
  agentSubline: string;
  whatsapps: string[];
  wechats: AdWeChatContact[];
  /** Soft-blur product UI screenshots (default true for publish exports). */
  privacyFog?: boolean;
  /** Optional client venue credit shown on the live-proof beat. */
  clientVenue?: ClientVenueInfo;
};

export const defaultAdProps: AdProps = {
  contactLine:
    'WhatsApp +351 911 092 527 / +351 925 736 572 · 微信 p9110925 / 强',
  ctaLine: '欢迎预约演示',
  agentLine: '诚招代理',
  agentSubline: '区域合作 · 本地部署支持',
  whatsapps: ['+351 911 092 527', '+351 925 736 572'],
  wechats: [
    { display: 'p9110925', qrFile: 'contact/wechat-qr.png' },
    { display: '强', qrFile: 'contact/wechat-qr-qiang.png' },
  ],
  privacyFog: true,
  clientVenue: {
    title: 'Torres Vedras · Buffet Livre',
    intro: '中式 / 亚洲餐 + 葡餐综合自助',
    address: '2560-250 Torres Vedras',
    hours: '午餐 12:00–15:00 · 晚餐 19:00–23:00',
    note: '约 €15–20/人 · 评分约 4.3',
  },
};
