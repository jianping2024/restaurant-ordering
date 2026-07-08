export type LandingWhatsAppContact = {
  display: string;
  waUrl: string;
  /** Optional one-line role hint (e.g. language or responsibility). */
  hint?: string;
  /** Hero and secondary CTAs use the primary line. */
  primary?: boolean;
};

export type LandingWeChatContact = {
  key: string;
  display: string;
  qrPath: string;
  /** WeChat ID for search/copy; omit for QR-only contacts. */
  id?: string;
  hint?: string;
  primary?: boolean;
};

/** Single source for landing contact channels (sales → onboarding entry points). */
export const LANDING_WHATSAPP_CONTACTS: readonly LandingWhatsAppContact[] = [
  { display: '+351 911 092 527', waUrl: 'https://wa.me/351911092527', primary: true },
  { display: '+351 925 736 572', waUrl: 'https://wa.me/351925736572' },
];

export const LANDING_WECHAT_CONTACTS: readonly LandingWeChatContact[] = [
  {
    key: 'p9110925',
    display: 'p9110925',
    id: 'p9110925',
    qrPath: '/contact/wechat-qr.png',
    primary: true,
  },
  {
    key: 'qiang',
    display: '强',
    hint: '浙江 · 温州',
    qrPath: '/contact/wechat-qr-qiang.png',
  },
];

function resolvePrimaryWhatsApp(): LandingWhatsAppContact {
  return (
    LANDING_WHATSAPP_CONTACTS.find((contact) => contact.primary) ?? LANDING_WHATSAPP_CONTACTS[0]!
  );
}

export const LANDING_PRIMARY_WHATSAPP = resolvePrimaryWhatsApp();
export const LANDING_WHATSAPP_URL = LANDING_PRIMARY_WHATSAPP.waUrl;
