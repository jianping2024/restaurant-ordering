/**
 * Sole public paths for landing case-study and team photos.
 * Do not hardcode these paths in components.
 */
export const LANDING_PROOF_IMAGES = {
  storefront: '/landing/proof/p3.jpg',
  cashier: '/landing/proof/p2.jpg',
} as const;

/** Order matches `copy.team.founders` and `LANDING_CONTACT_PEOPLE`. */
export const LANDING_TEAM_PHOTOS = ['/landing/team/li.jpg', '/landing/team/chen.jpg'] as const;
