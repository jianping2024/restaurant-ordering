export type LandingPhoneContact = {
  display: string;
  waUrl: string;
};

export const LANDING_PHONE_CONTACTS: readonly LandingPhoneContact[] = [
  { display: '+351 911 092 527', waUrl: 'https://wa.me/351911092527' },
  { display: '+351 925 736 572', waUrl: 'https://wa.me/351925736572' },
];

export const LANDING_WHATSAPP_DISPLAY = LANDING_PHONE_CONTACTS[0]!.display;
export const LANDING_WHATSAPP_URL = LANDING_PHONE_CONTACTS[0]!.waUrl;
export const LANDING_WECHAT_ID = 'p9110925';
export const LANDING_WECHAT_QR_PATH = '/contact/wechat-qr.png';
