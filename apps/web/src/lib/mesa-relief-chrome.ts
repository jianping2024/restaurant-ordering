/**
 * Gold-relief surface class names — one representation for staff + customer.
 * `goldFace` owns fill + shadow (do not also set bg-brand-gold).
 * Layout sizes (padding/gap/type/grid) stay outside these tokens.
 */
export const MESA_RELIEF = {
  card: 'mesa-relief-card',
  goldFace: 'mesa-relief-gold-face',
  dock: 'mesa-relief-dock',
  topBar: 'mesa-relief-top-bar',
} as const;
