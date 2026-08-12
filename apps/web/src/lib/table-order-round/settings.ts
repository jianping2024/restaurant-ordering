/** Sole clamp/parse helpers for sushi table-order-round restaurant columns. */

import { isSushiBuffetMode } from '@mesa/shared';

export const SUSHI_ROUND_ORDERING_ENABLED_DEFAULT = true;

export const SUSHI_PER_PERSON_PER_ROUND_CAP_DEFAULT = 8;
export const SUSHI_PER_PERSON_PER_ROUND_CAP_MIN = 1;
export const SUSHI_PER_PERSON_PER_ROUND_CAP_MAX = 20;

export const SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_DEFAULT = 25;
export const SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MIN = 15;
export const SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MAX = 45;

export const SUSHI_ROUND_COOLDOWN_SECONDS_DEFAULT = 120;
export const SUSHI_ROUND_COOLDOWN_SECONDS_MIN = 30;
export const SUSHI_ROUND_COOLDOWN_SECONDS_MAX = 600;

export const SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_DEFAULT = 30;
export const SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MIN = 15;
export const SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MAX = 120;

export type SushiRoundSettings = {
  sushi_round_ordering_enabled: boolean;
  sushi_per_person_per_round_cap: number;
  sushi_round_confirm_timeout_seconds: number;
  sushi_round_cooldown_seconds: number;
  sushi_round_defer_cooldown_seconds: number;
};

export const DEFAULT_SUSHI_ROUND_SETTINGS: SushiRoundSettings = {
  sushi_round_ordering_enabled: SUSHI_ROUND_ORDERING_ENABLED_DEFAULT,
  sushi_per_person_per_round_cap: SUSHI_PER_PERSON_PER_ROUND_CAP_DEFAULT,
  sushi_round_confirm_timeout_seconds: SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_DEFAULT,
  sushi_round_cooldown_seconds: SUSHI_ROUND_COOLDOWN_SECONDS_DEFAULT,
  sushi_round_defer_cooldown_seconds: SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_DEFAULT,
};

function clampIntInRange(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return Math.max(min, Math.min(max, rounded));
}

export function clampSushiRoundOrderingEnabled(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  return SUSHI_ROUND_ORDERING_ENABLED_DEFAULT;
}

/** Guest free dish for round basket: menu unit price exactly 0. */
export function isSushiRoundFreeMenuPrice(price: unknown): boolean {
  return typeof price === 'number' && Number.isFinite(price) && price === 0;
}

export function clampSushiPerPersonPerRoundCap(raw: unknown): number {
  return clampIntInRange(
    raw,
    SUSHI_PER_PERSON_PER_ROUND_CAP_MIN,
    SUSHI_PER_PERSON_PER_ROUND_CAP_MAX,
    SUSHI_PER_PERSON_PER_ROUND_CAP_DEFAULT,
  );
}

export function clampSushiRoundConfirmTimeoutSeconds(raw: unknown): number {
  return clampIntInRange(
    raw,
    SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MIN,
    SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MAX,
    SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_DEFAULT,
  );
}

export function clampSushiRoundCooldownSeconds(raw: unknown): number {
  return clampIntInRange(
    raw,
    SUSHI_ROUND_COOLDOWN_SECONDS_MIN,
    SUSHI_ROUND_COOLDOWN_SECONDS_MAX,
    SUSHI_ROUND_COOLDOWN_SECONDS_DEFAULT,
  );
}

export function clampSushiRoundDeferCooldownSeconds(raw: unknown): number {
  return clampIntInRange(
    raw,
    SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MIN,
    SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MAX,
    SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_DEFAULT,
  );
}

export type SushiRoundRestaurantRow = {
  sushi_round_ordering_enabled?: unknown;
  sushi_per_person_per_round_cap?: unknown;
  sushi_round_confirm_timeout_seconds?: unknown;
  sushi_round_cooldown_seconds?: unknown;
  sushi_round_defer_cooldown_seconds?: unknown;
};

export function parseSushiRoundSettingsFromRestaurantRow(
  row: SushiRoundRestaurantRow | null | undefined,
): SushiRoundSettings {
  if (!row) return { ...DEFAULT_SUSHI_ROUND_SETTINGS };
  return {
    sushi_round_ordering_enabled: clampSushiRoundOrderingEnabled(row.sushi_round_ordering_enabled),
    sushi_per_person_per_round_cap: clampSushiPerPersonPerRoundCap(row.sushi_per_person_per_round_cap),
    sushi_round_confirm_timeout_seconds: clampSushiRoundConfirmTimeoutSeconds(
      row.sushi_round_confirm_timeout_seconds,
    ),
    sushi_round_cooldown_seconds: clampSushiRoundCooldownSeconds(row.sushi_round_cooldown_seconds),
    sushi_round_defer_cooldown_seconds: clampSushiRoundDeferCooldownSeconds(
      row.sushi_round_defer_cooldown_seconds,
    ),
  };
}

function parseOptionalBool(raw: unknown): boolean | null | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'boolean') return null;
  return raw;
}

function parseOptionalIntInRange(
  raw: unknown,
  min: number,
  max: number,
): number | null | undefined {
  if (raw === undefined) return undefined;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (!Number.isInteger(rounded) || rounded < min || rounded > max) return null;
  return rounded;
}

/** PATCH body fields for features API. `null` = invalid; empty object = no sushi patch. */
export type SushiRoundSettingsPatch = Partial<SushiRoundSettings>;

export function parseSushiRoundSettingsPatch(
  body: unknown,
): { ok: true; patch: SushiRoundSettingsPatch } | { ok: false; error: string } | { ok: true; patch: null } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: true, patch: null };
  }
  const raw = body as Record<string, unknown>;
  const keys = [
    'sushiRoundOrderingEnabled',
    'sushi_round_ordering_enabled',
    'sushiPerPersonPerRoundCap',
    'sushi_per_person_per_round_cap',
    'sushiRoundConfirmTimeoutSeconds',
    'sushi_round_confirm_timeout_seconds',
    'sushiRoundCooldownSeconds',
    'sushi_round_cooldown_seconds',
    'sushiRoundDeferCooldownSeconds',
    'sushi_round_defer_cooldown_seconds',
  ] as const;
  if (!keys.some((k) => k in raw)) {
    return { ok: true, patch: null };
  }

  const patch: SushiRoundSettingsPatch = {};

  if ('sushiRoundOrderingEnabled' in raw || 'sushi_round_ordering_enabled' in raw) {
    const v = parseOptionalBool(
      raw.sushiRoundOrderingEnabled !== undefined
        ? raw.sushiRoundOrderingEnabled
        : raw.sushi_round_ordering_enabled,
    );
    if (v === null) return { ok: false, error: 'invalid_sushi_round_ordering_enabled' };
    if (v !== undefined) patch.sushi_round_ordering_enabled = v;
  }

  if ('sushiPerPersonPerRoundCap' in raw || 'sushi_per_person_per_round_cap' in raw) {
    const v = parseOptionalIntInRange(
      raw.sushiPerPersonPerRoundCap !== undefined
        ? raw.sushiPerPersonPerRoundCap
        : raw.sushi_per_person_per_round_cap,
      SUSHI_PER_PERSON_PER_ROUND_CAP_MIN,
      SUSHI_PER_PERSON_PER_ROUND_CAP_MAX,
    );
    if (v === null) return { ok: false, error: 'invalid_sushi_per_person_per_round_cap' };
    if (v !== undefined) patch.sushi_per_person_per_round_cap = v;
  }

  if ('sushiRoundConfirmTimeoutSeconds' in raw || 'sushi_round_confirm_timeout_seconds' in raw) {
    const v = parseOptionalIntInRange(
      raw.sushiRoundConfirmTimeoutSeconds !== undefined
        ? raw.sushiRoundConfirmTimeoutSeconds
        : raw.sushi_round_confirm_timeout_seconds,
      SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MIN,
      SUSHI_ROUND_CONFIRM_TIMEOUT_SECONDS_MAX,
    );
    if (v === null) return { ok: false, error: 'invalid_sushi_round_confirm_timeout_seconds' };
    if (v !== undefined) patch.sushi_round_confirm_timeout_seconds = v;
  }

  if ('sushiRoundCooldownSeconds' in raw || 'sushi_round_cooldown_seconds' in raw) {
    const v = parseOptionalIntInRange(
      raw.sushiRoundCooldownSeconds !== undefined
        ? raw.sushiRoundCooldownSeconds
        : raw.sushi_round_cooldown_seconds,
      SUSHI_ROUND_COOLDOWN_SECONDS_MIN,
      SUSHI_ROUND_COOLDOWN_SECONDS_MAX,
    );
    if (v === null) return { ok: false, error: 'invalid_sushi_round_cooldown_seconds' };
    if (v !== undefined) patch.sushi_round_cooldown_seconds = v;
  }

  if ('sushiRoundDeferCooldownSeconds' in raw || 'sushi_round_defer_cooldown_seconds' in raw) {
    const v = parseOptionalIntInRange(
      raw.sushiRoundDeferCooldownSeconds !== undefined
        ? raw.sushiRoundDeferCooldownSeconds
        : raw.sushi_round_defer_cooldown_seconds,
      SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MIN,
      SUSHI_ROUND_DEFER_COOLDOWN_SECONDS_MAX,
    );
    if (v === null) return { ok: false, error: 'invalid_sushi_round_defer_cooldown_seconds' };
    if (v !== undefined) patch.sushi_round_defer_cooldown_seconds = v;
  }

  return { ok: true, patch };
}

export function sushiRoundSettingsToApiJson(settings: SushiRoundSettings) {
  return {
    sushiRoundOrderingEnabled: settings.sushi_round_ordering_enabled,
    sushiPerPersonPerRoundCap: settings.sushi_per_person_per_round_cap,
    sushiRoundConfirmTimeoutSeconds: settings.sushi_round_confirm_timeout_seconds,
    sushiRoundCooldownSeconds: settings.sushi_round_cooldown_seconds,
    sushiRoundDeferCooldownSeconds: settings.sushi_round_defer_cooldown_seconds,
  };
}

/** Sole page-branch predicate: guest sushi + round on → SushiMenuPage; else Classic. */
export function shouldRenderSushiRoundMenuPage(params: {
  buffetServiceMode: unknown;
  sushiRoundOrderingEnabled: unknown;
  staffAssisted: boolean;
}): boolean {
  if (params.staffAssisted) return false;
  if (!isSushiBuffetMode(params.buffetServiceMode)) return false;
  return clampSushiRoundOrderingEnabled(params.sushiRoundOrderingEnabled);
}
