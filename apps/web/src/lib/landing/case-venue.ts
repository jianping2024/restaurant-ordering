/**
 * Sole language-neutral facts for the landing customer case (Pirata).
 * Display copy (section title, hours) stays in `getLandingCopy().caseStudy`.
 */
export const LANDING_CASE_VENUE = {
  name: 'Pirata Restaurant',
  address: 'Sentido Torres Vedras 9, 2560-250 Torres Vedras',
  phoneDisplay: '261 244 930',
  phoneTel: '+351261244930',
} as const;

export const LANDING_CASE_VENUE_MAPS_URL =
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(LANDING_CASE_VENUE.address)}` as const;

export const LANDING_CASE_VENUE_TEL_HREF = `tel:${LANDING_CASE_VENUE.phoneTel}` as const;
