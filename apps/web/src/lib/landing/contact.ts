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

export type LandingContactPerson = {
  key: 'li' | 'chen';
  whatsapp: LandingWhatsAppContact;
  wechat: LandingWeChatContact;
};

/** Sole sales contacts, one person per advisor (names live in `copy.team.founders`, same order). */
export const LANDING_CONTACT_PEOPLE: readonly [LandingContactPerson, LandingContactPerson] = [
  {
    key: 'li',
    whatsapp: { display: '+351 925 736 572', waUrl: 'https://wa.me/351925736572' },
    wechat: {
      key: 'qiang',
      display: '强',
      hint: '浙江 · 温州',
      qrPath: '/contact/wechat-qr-qiang.png',
    },
  },
  {
    key: 'chen',
    whatsapp: { display: '+351 911 092 527', waUrl: 'https://wa.me/351911092527', primary: true },
    wechat: {
      key: 'p9110925',
      display: 'p9110925',
      id: 'p9110925',
      qrPath: '/contact/wechat-qr.png',
      primary: true,
    },
  },
];

/** Flat channel lists (store renew modal / Pro gate) derived from the same people. */
export const LANDING_WHATSAPP_CONTACTS: readonly LandingWhatsAppContact[] = [
  LANDING_CONTACT_PEOPLE[1].whatsapp,
  LANDING_CONTACT_PEOPLE[0].whatsapp,
];

export const LANDING_WECHAT_CONTACTS: readonly LandingWeChatContact[] = [
  LANDING_CONTACT_PEOPLE[1].wechat,
  LANDING_CONTACT_PEOPLE[0].wechat,
];

function resolvePrimaryWhatsApp(): LandingWhatsAppContact {
  return (
    LANDING_WHATSAPP_CONTACTS.find((contact) => contact.primary) ?? LANDING_WHATSAPP_CONTACTS[0]!
  );
}

export const LANDING_PRIMARY_WHATSAPP = resolvePrimaryWhatsApp();
export const LANDING_WHATSAPP_URL = LANDING_PRIMARY_WHATSAPP.waUrl;
