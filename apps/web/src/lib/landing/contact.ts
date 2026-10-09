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
  key: 'li';
  /** Index into `copy.team.founders` for the on-screen advisor name. */
  founderIndex: 0;
  whatsapp: LandingWhatsAppContact;
  wechat: LandingWeChatContact;
};

/**
 * Sole sales contact (李先生). Team section may still list more founders;
 * contact channels, renew modal, and Pro gate all read this one list.
 */
export const LANDING_CONTACT_PEOPLE: readonly [LandingContactPerson] = [
  {
    key: 'li',
    founderIndex: 0,
    whatsapp: {
      display: '+351 925 736 572',
      waUrl: 'https://wa.me/351925736572',
      primary: true,
    },
    wechat: {
      key: 'qiang',
      display: '强',
      hint: '浙江 · 温州',
      qrPath: '/contact/wechat-qr-qiang.png',
      primary: true,
    },
  },
];

/** Flat channel lists (store renew modal / Pro gate) derived from the same people. */
export const LANDING_WHATSAPP_CONTACTS: readonly LandingWhatsAppContact[] =
  LANDING_CONTACT_PEOPLE.map((person) => person.whatsapp);

export const LANDING_WECHAT_CONTACTS: readonly LandingWeChatContact[] =
  LANDING_CONTACT_PEOPLE.map((person) => person.wechat);

function resolvePrimaryWhatsApp(): LandingWhatsAppContact {
  return (
    LANDING_WHATSAPP_CONTACTS.find((contact) => contact.primary) ?? LANDING_WHATSAPP_CONTACTS[0]!
  );
}

export const LANDING_PRIMARY_WHATSAPP = resolvePrimaryWhatsApp();
export const LANDING_WHATSAPP_URL = LANDING_PRIMARY_WHATSAPP.waUrl;
