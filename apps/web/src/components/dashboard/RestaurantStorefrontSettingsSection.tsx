'use client';

import { useState } from 'react';
import type { RestaurantSettingsProfile } from '@/types';
import { resolveMenuImageDisplayUrl } from '@/lib/menu-image';
import {
  DEFAULT_RESTAURANT_DAY_WINDOW,
  DEFAULT_RESTAURANT_EXTRA_WINDOW,
  RESTAURANT_WEEKDAY_KEYS,
  RESTAURANT_WEEKDAY_KEYS_MON_FRI,
  applyRestaurantDayWindowsToDays,
  emptyRestaurantBusinessHours,
  normalizeRestaurantBusinessHours,
  restaurantDayWindows,
  setRestaurantDayWindows,
  type RestaurantBusinessHours,
  type RestaurantWeekdayKey,
} from '@/lib/restaurant-business-hours';
import {
  STOREFRONT_IMAGE_ACCEPT,
  compressStorefrontImageFile,
  resolveStorefrontCoverUrl,
  type StorefrontImageKind,
} from '@/lib/restaurant-storefront-image';
import {
  STOREFRONT_INTRO_MAX,
  normalizeStorefrontIntro,
  type StorefrontIntroI18n,
} from '@/lib/restaurant-storefront-intro';
import { TimeHmInput } from '@/components/ui/TimeHmInput';

export type RestaurantStorefrontSettingsCopy = {
  storefrontSectionTitle: string;
  storefrontSectionDesc: string;
  logo: string;
  cover: string;
  upload: string;
  removeImage: string;
  imageUploading: string;
  imageFail: string;
  imageTooLarge: string;
  introPt: string;
  introEn: string;
  introZh: string;
  introHint: string;
  hoursTitle: string;
  hoursHint: string;
  hoursOpen: string;
  hoursClose: string;
  hoursClosed: string;
  hoursOpenDay: string;
  hoursAddWindow: string;
  hoursRemoveWindow: string;
  hoursApplyWeekdays: string;
  hoursApplyAll: string;
  weekdayLabels: Record<RestaurantWeekdayKey, string>;
};

type Props = {
  copy: RestaurantStorefrontSettingsCopy;
  intro: StorefrontIntroI18n;
  hours: RestaurantBusinessHours;
  onIntroChange: (next: StorefrontIntroI18n) => void;
  onHoursChange: (next: RestaurantBusinessHours) => void;
  onImageUrlChange: (kind: StorefrontImageKind, url: string | null) => void;
  logoUrl: string | null;
  coverUrl: string | null;
};

async function postStorefrontImage(
  kind: StorefrontImageKind,
  file: File | null,
  strip: boolean,
): Promise<{ url: string | null } | { error: string }> {
  const form = new FormData();
  form.set('kind', kind);
  if (strip) form.set('strip_image', '1');
  if (file) form.set('file', file);
  const res = await fetch('/api/restaurant/storefront-image', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    url?: string | null;
  };
  if (!res.ok) {
    return { error: json.error || 'upload_failed' };
  }
  return { url: json.url ?? null };
}

export function restaurantStorefrontDraftFromProfile(restaurant: RestaurantSettingsProfile): {
  intro: StorefrontIntroI18n;
  hours: RestaurantBusinessHours;
  logoUrl: string | null;
  coverUrl: string | null;
} {
  return {
    intro: normalizeStorefrontIntro(restaurant.storefront_intro),
    hours: normalizeRestaurantBusinessHours(
      restaurant.business_hours ?? emptyRestaurantBusinessHours(),
    ),
    logoUrl: restaurant.logo_url?.trim() || null,
    coverUrl: restaurant.cover_url?.trim() || null,
  };
}

/** Sole settings editor for guest storefront cover / logo / hours / intro. */
export function RestaurantStorefrontSettingsSection({
  copy,
  intro,
  hours,
  onIntroChange,
  onHoursChange,
  onImageUrlChange,
  logoUrl,
  coverUrl,
}: Props) {
  const [uploading, setUploading] = useState<StorefrontImageKind | null>(null);
  const [imageError, setImageError] = useState('');

  const runUpload = async (kind: StorefrontImageKind, file: File | null, strip: boolean) => {
    setImageError('');
    setUploading(kind);
    try {
      let prepared: File | null = file;
      if (file) {
        try {
          prepared = await compressStorefrontImageFile(file, kind);
        } catch (err) {
          const code = err instanceof Error ? err.message : '';
          setImageError(code === 'image_too_large' ? copy.imageTooLarge : copy.imageFail);
          return;
        }
      }
      const result = await postStorefrontImage(kind, prepared, strip);
      if ('error' in result) {
        setImageError(
          result.error === 'invalid_image' || result.error === 'image_too_large'
            ? copy.imageTooLarge
            : copy.imageFail,
        );
        return;
      }
      onImageUrlChange(kind, result.url);
    } catch {
      setImageError(copy.imageFail);
    } finally {
      setUploading(null);
    }
  };

  const renderImageRow = (kind: StorefrontImageKind, label: string, url: string | null) => {
    const display =
      kind === 'cover' ? resolveStorefrontCoverUrl(url) : resolveMenuImageDisplayUrl(url);
    const busy = uploading === kind;
    const inputId = `storefront-image-${kind}`;
    const pickClass = busy
      ? 'pointer-events-none opacity-50'
      : 'cursor-pointer hover:bg-brand-bg';
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-brand-text">{label}</div>
        <div className="flex items-center gap-3">
          <label
            htmlFor={inputId}
            aria-label={copy.upload}
            className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-brand-border bg-brand-bg ${pickClass}`}
          >
            {display ? (
              // eslint-disable-next-line @next/next/no-img-element -- settings preview; URL may be relative /storage
              <img src={display} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-brand-text-muted">
                —
              </div>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className={`rounded-lg border border-brand-border px-3 py-1.5 text-sm text-brand-text ${pickClass}`}
            >
              {busy ? copy.imageUploading : copy.upload}
            </label>
            {url ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runUpload(kind, null, true)}
                className="rounded-lg border border-brand-border px-3 py-1.5 text-sm text-brand-text-muted hover:bg-brand-bg disabled:opacity-50"
              >
                {copy.removeImage}
              </button>
            ) : null}
          </div>
          <input
            id={inputId}
            type="file"
            accept={STOREFRONT_IMAGE_ACCEPT}
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = '';
              if (file) void runUpload(kind, file, false);
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <fieldset className="space-y-4 rounded-xl border border-brand-border/70 bg-brand-bg/40 p-4">
      <legend className="px-1 text-sm font-medium text-brand-text">{copy.storefrontSectionTitle}</legend>
      <p className="text-[13px] leading-relaxed text-brand-text-muted">{copy.storefrontSectionDesc}</p>

      {renderImageRow('logo', copy.logo, logoUrl)}
      {renderImageRow('cover', copy.cover, coverUrl)}
      {imageError ? <p className="mesa-alert-danger px-3 py-2 text-sm">{imageError}</p> : null}

      <div className="space-y-3">
        <div className="text-sm font-medium text-brand-text">{copy.hoursTitle}</div>
        <p className="text-[13px] text-brand-text-muted">{copy.hoursHint}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-brand-border px-2.5 py-1 text-[12px] text-brand-text hover:bg-brand-bg"
            onClick={() =>
              onHoursChange(
                applyRestaurantDayWindowsToDays(hours, '1', RESTAURANT_WEEKDAY_KEYS_MON_FRI),
              )
            }
          >
            {copy.hoursApplyWeekdays}
          </button>
          <button
            type="button"
            className="rounded-lg border border-brand-border px-2.5 py-1 text-[12px] text-brand-text hover:bg-brand-bg"
            onClick={() =>
              onHoursChange(applyRestaurantDayWindowsToDays(hours, '1', RESTAURANT_WEEKDAY_KEYS))
            }
          >
            {copy.hoursApplyAll}
          </button>
        </div>
        <div className="space-y-3">
          {RESTAURANT_WEEKDAY_KEYS.map((day) => {
            const windows = restaurantDayWindows(hours, day);
            const dayOpen = windows.length > 0;
            return (
              <div
                key={day}
                className="rounded-lg border border-brand-border/70 bg-brand-bg/50 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-brand-text">
                    {copy.weekdayLabels[day]}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dayOpen}
                    aria-label={`${copy.weekdayLabels[day]} ${dayOpen ? copy.hoursOpenDay : copy.hoursClosed}`}
                    onClick={() =>
                      onHoursChange(
                        setRestaurantDayWindows(
                          hours,
                          day,
                          dayOpen ? [] : [{ ...DEFAULT_RESTAURANT_DAY_WINDOW }],
                        ),
                      )
                    }
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      dayOpen ? 'bg-brand-gold' : 'bg-brand-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        dayOpen ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {dayOpen ? (
                  <div className="mt-2 space-y-2">
                    {windows.map((win, index) => (
                      <div key={`${day}-${index}`} className="flex flex-wrap items-end gap-2">
                        <TimeHmInput
                          compact
                          label={copy.hoursOpen}
                          value={win.open}
                          onChange={(open) => {
                            const next = windows.map((row, i) =>
                              i === index ? { ...row, open } : row,
                            );
                            onHoursChange(setRestaurantDayWindows(hours, day, next));
                          }}
                        />
                        <span className="pb-2 text-brand-text-muted" aria-hidden>
                          –
                        </span>
                        <TimeHmInput
                          compact
                          label={copy.hoursClose}
                          value={win.close}
                          onChange={(close) => {
                            const next = windows.map((row, i) =>
                              i === index ? { ...row, close } : row,
                            );
                            onHoursChange(setRestaurantDayWindows(hours, day, next));
                          }}
                        />
                        {windows.length > 1 ? (
                          <button
                            type="button"
                            className="pb-1.5 text-[12px] text-brand-text-muted hover:underline"
                            onClick={() => {
                              const next = windows.filter((_, i) => i !== index);
                              onHoursChange(setRestaurantDayWindows(hours, day, next));
                            }}
                          >
                            {copy.hoursRemoveWindow}
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-[12px] font-medium text-brand-gold hover:underline"
                      onClick={() =>
                        onHoursChange(
                          setRestaurantDayWindows(hours, day, [
                            ...windows,
                            { ...DEFAULT_RESTAURANT_EXTRA_WINDOW },
                          ]),
                        )
                      }
                    >
                      {copy.hoursAddWindow}
                    </button>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[12px] text-brand-text-muted">{copy.hoursClosed}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[13px] text-brand-text-muted">{copy.introHint}</p>
        {(
          [
            ['pt', copy.introPt],
            ['en', copy.introEn],
            ['zh', copy.introZh],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label className="mb-1.5 block text-sm font-medium text-brand-text-muted" htmlFor={`storefront-intro-${key}`}>
              {label}
            </label>
            <textarea
              id={`storefront-intro-${key}`}
              rows={3}
              maxLength={STOREFRONT_INTRO_MAX}
              value={intro[key]}
              onChange={(e) => onIntroChange({ ...intro, [key]: e.target.value })}
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
