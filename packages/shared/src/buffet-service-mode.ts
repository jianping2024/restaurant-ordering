/** Restaurant buffet operating mode — classic unlimited vs sushi per-person limits. */

export const BUFFET_SERVICE_MODES = ['classic', 'sushi'] as const;

export type BuffetServiceMode = (typeof BUFFET_SERVICE_MODES)[number];

export const DEFAULT_BUFFET_SERVICE_MODE: BuffetServiceMode = 'classic';

export function isBuffetServiceMode(value: unknown): value is BuffetServiceMode {
  return value === 'classic' || value === 'sushi';
}

export function normalizeBuffetServiceMode(raw: unknown): BuffetServiceMode {
  return isBuffetServiceMode(raw) ? raw : DEFAULT_BUFFET_SERVICE_MODE;
}

export function parseBuffetServiceMode(raw: unknown): BuffetServiceMode | null {
  return isBuffetServiceMode(raw) ? raw : null;
}

/** Limits / overage pricing apply only in sushi mode. */
export function isSushiBuffetMode(mode: unknown): boolean {
  return normalizeBuffetServiceMode(mode) === 'sushi';
}
