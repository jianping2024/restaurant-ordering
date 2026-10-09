import { LANDING_PROOF_IMAGES, LANDING_TEAM_PHOTOS } from '@/lib/landing/proof-assets';
import type { CustomerStorefrontBandModel } from '@/components/menu/CustomerStorefrontBand';

const DAY = (weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7) => ({
  weekday,
  windows: [
    { open: '12:00', close: '15:00' },
    { open: '18:00', close: '23:00' },
  ],
});

/** Static mock for `/preview/storefront-menu` only — not production restaurant data. */
export function buildCustomerStorefrontPreviewModel(): CustomerStorefrontBandModel {
  return {
    name: 'Casa Portuguesa',
    logoUrl: LANDING_TEAM_PHOTOS[0] ?? null,
    coverUrl: LANDING_PROOF_IMAGES.storefront,
    intro: {
      zh: '正宗葡式家常菜，精选海鲜与炭烤，适合与亲友共享慢用餐时光。',
      en: 'Homestyle Portuguese cooking — seafood and grill, made for sharing.',
      pt: 'Cozinha portuguesa caseira — marisco e grelhados para partilhar.',
    },
    address: 'Rua Augusta 120, Lisboa',
    phone: '+351 912 345 678',
    mapsUrl: 'https://maps.google.com/?q=Rua+Augusta+120,+Lisboa',
    todayWindows: [
      { open: '12:00', close: '15:00' },
      { open: '18:00', close: '23:00' },
    ],
    weekHours: [1, 2, 3, 4, 5, 6, 7].map((d) => DAY(d as 1 | 2 | 3 | 4 | 5 | 6 | 7)),
    openNow: true,
    openUntilLabel: '23:00',
  };
}
