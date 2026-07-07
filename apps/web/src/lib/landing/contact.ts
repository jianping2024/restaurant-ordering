export type LandingWhatsAppContact = {
  display: string;
  waUrl: string;
  /** Optional one-line role hint (e.g. language or responsibility). */
  hint?: string;
  /** Hero and secondary CTAs use the primary line. */
  primary?: boolean;
};

export type LandingWeChatContact = {
  id: string;
  qrPath: string;
};

/** Single source for landing contact channels (sales → onboarding entry points). */
export const LANDING_WHATSAPP_CONTACTS: readonly LandingWhatsAppContact[] = [
  { display: '+351 911 092 527', waUrl: 'https://wa.me/351911092527', primary: true },
  { display: '+351 925 736 572', waUrl: 'https://wa.me/351925736572' },
];

export const LANDING_WECHAT: LandingWeChatContact = {
  id: 'p9110925',
  qrPath: '/contact/wechat-qr.png',
};

function resolvePrimaryWhatsApp(): LandingWhatsAppContact {
  return (
    LANDING_WHATSAPP_CONTACTS.find((contact) => contact.primary) ?? LANDING_WHATSAPP_CONTACTS[0]!
  );
}

export const LANDING_PRIMARY_WHATSAPP = resolvePrimaryWhatsApp();
export const LANDING_WHATSAPP_URL = LANDING_PRIMARY_WHATSAPP.waUrl;
export const LANDING_WECHAT_ID = LANDING_WECHAT.id;
export const LANDING_WECHAT_QR_PATH = LANDING_WECHAT.qrPath;
