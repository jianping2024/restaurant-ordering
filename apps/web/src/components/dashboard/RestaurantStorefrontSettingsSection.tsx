'use client';

import { useRef, useState } from 'react';
import type { RestaurantSettingsProfile } from '@/types';
import { resolveMenuImageDisplayUrl } from '@/lib/menu-image';
import {
  emptyRestaurantBusinessHours,
  normalizeRestaurantBusinessHours,
  type RestaurantBusinessHours,
  type RestaurantHoursWindow,
} from '@/lib/restaurant-business-hours';
import {
  STOREFRONT_IMAGE_ACCEPT,
  compressStorefrontImageFile,
  type StorefrontImageKind,
} from '@/lib/restaurant-storefront-image';
import {
  STOREFRONT_INTRO_MAX,
  normalizeStorefrontIntro,
  type StorefrontIntroI18n,
} from '@/lib/restaurant-storefront-intro';

type WeekdayKey = '1' | '2' | '3' | '4' | '5' | '6' | '7';

const WEEKDAY_KEYS: WeekdayKey[] = ['1', '2', '3', '4', '5', '6', '7'];

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
  weekdayLabels: Record<WeekdayKey, string>;
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

function dayWindow(
  hours: RestaurantBusinessHours,
  day: WeekdayKey,
): RestaurantHoursWindow | null {
  const windows = hours.week[day];
  return windows?.[0] ?? null;
}

function setDayWindow(
  hours: RestaurantBusinessHours,
  day: WeekdayKey,
  window: RestaurantHoursWindow | null,
): RestaurantBusinessHours {
  const week = { ...hours.week };
  if (!window || !window.open || !window.close) {
    delete week[day];
  } else {
    week[day] = [{ open: window.open, close: window.close }];
  }
  return { ...hours, week };
}

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
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
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

  const renderImageRow = (
    kind: StorefrontImageKind,
    label: string,
    url: string | null,
    inputRef: { current: HTMLInputElement | null },
  ) => {
    const display = resolveMenuImageDisplayUrl(url);
    const busy = uploading === kind;
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-brand-text">{label}</div>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-brand-border bg-brand-bg">
            {display ? (
              // eslint-disable-next-line @next/next/no-img-element -- settings preview; URL may be relative /storage
              <img src={display} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-brand-text-muted">
                —
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-brand-border px-3 py-1.5 text-sm text-brand-text hover:bg-brand-bg disabled:opacity-50"
            >
              {busy ? copy.imageUploading : copy.upload}
            </button>
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
            ref={inputRef}
            type="file"
            accept={STOREFRONT_IMAGE_ACCEPT}
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

      {renderImageRow('logo', copy.logo, logoUrl, logoInputRef)}
      {renderImageRow('cover', copy.cover, coverUrl, coverInputRef)}
      {imageError ? <p className="mesa-alert-danger px-3 py-2 text-sm">{imageError}</p> : null}

      <div className="space-y-3">
        <div className="text-sm font-medium text-brand-text">{copy.hoursTitle}</div>
        <p className="text-[13px] text-brand-text-muted">{copy.hoursHint}</p>
        <div className="space-y-2">
          {WEEKDAY_KEYS.map((day) => {
            const win = dayWindow(hours, day);
            return (
              <div
                key={day}
                className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-2 sm:grid-cols-[5.5rem_7rem_7rem_auto]"
              >
                <span className="text-sm text-brand-text">{copy.weekdayLabels[day]}</span>
                <label className="sr-only" htmlFor={`storefront-open-${day}`}>
                  {copy.hoursOpen}
                </label>
                <input
                  id={`storefront-open-${day}`}
                  type="time"
                  value={win?.open ?? ''}
                  onChange={(e) => {
                    const open = e.target.value;
                    const close = win?.close ?? '';
                    onHoursChange(
                      setDayWindow(
                        hours,
                        day,
                        open && close ? { open, close } : open ? { open, close: open } : null,
                      ),
                    );
                  }}
                  className="rounded-lg border border-brand-border bg-brand-bg px-2 py-1.5 text-sm text-brand-text"
                />
                <label className="sr-only" htmlFor={`storefront-close-${day}`}>
                  {copy.hoursClose}
                </label>
                <input
                  id={`storefront-close-${day}`}
                  type="time"
                  value={win?.close ?? ''}
                  onChange={(e) => {
                    const close = e.target.value;
                    const open = win?.open ?? '';
                    onHoursChange(
                      setDayWindow(
                        hours,
                        day,
                        open && close ? { open, close } : close ? { open: close, close } : null,
                      ),
                    );
                  }}
                  className="rounded-lg border border-brand-border bg-brand-bg px-2 py-1.5 text-sm text-brand-text"
                />
                <button
                  type="button"
                  className="hidden text-[12px] text-brand-text-muted hover:underline sm:inline"
                  onClick={() => onHoursChange(setDayWindow(hours, day, null))}
                >
                  {copy.hoursClosed}
                </button>
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
