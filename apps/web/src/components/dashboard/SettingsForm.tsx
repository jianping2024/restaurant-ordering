'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RESTAURANT_COUNTRY_OPTIONS, readGeoOrderRestrictionEnabled, type RestaurantCountryCode } from '@mesa/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { RestaurantSettingsProfile } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  MAX_ORDER_RADIUS_METERS,
  MIN_ORDER_RADIUS_METERS,
  normalizeOrderRadiusMeters,
  parseOrderRadiusInput,
} from '@/lib/order-radius';
import {
  RestaurantStorefrontSettingsSection,
  restaurantStorefrontDraftFromProfile,
} from '@/components/dashboard/RestaurantStorefrontSettingsSection';
import { dashboardStickyToolbarShellClass } from '@/lib/waiter-staff-sticky-chrome';

export function SettingsForm({
  restaurant,
  embedded,
}: {
  restaurant: RestaurantSettingsProfile;
  embedded?: boolean;
}) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).settings;
  const hasStoredCoordinates =
    restaurant.geo_latitude != null && restaurant.geo_longitude != null;
  const storefrontSeed = restaurantStorefrontDraftFromProfile(restaurant);
  const [form, setForm] = useState({
    name: restaurant.name,
    address: restaurant.address || '',
    phone: restaurant.phone || '',
    countryCode: (restaurant.country_code || 'PT') as RestaurantCountryCode,
    geo_latitude: restaurant.geo_latitude != null ? String(restaurant.geo_latitude) : '',
    geo_longitude: restaurant.geo_longitude != null ? String(restaurant.geo_longitude) : '',
    order_radius_meters: String(normalizeOrderRadiusMeters(restaurant.order_radius_meters)),
    geoOrderRestrictionEnabled: readGeoOrderRestrictionEnabled(
      restaurant.feature_flags,
      hasStoredCoordinates,
    ),
  });
  const [intro, setIntro] = useState(storefrontSeed.intro);
  const [hours, setHours] = useState(storefrontSeed.hours);
  const [logoUrl, setLogoUrl] = useState(storefrontSeed.logoUrl);
  const [coverUrl, setCoverUrl] = useState(storefrontSeed.coverUrl);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const getCurrentPositionWithFallback = async () => {
    const attempt = (options: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    try {
      return await attempt({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      });
    } catch {
      return attempt({
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 120000,
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!form.name.trim()) { setError(t.nameEmpty); return; }
    const hasLat = form.geo_latitude.trim() !== '';
    const hasLng = form.geo_longitude.trim() !== '';
    if (hasLat !== hasLng) {
      setError(t.geoInvalid);
      return;
    }
    const latitude = hasLat ? Number(form.geo_latitude) : null;
    const longitude = hasLng ? Number(form.geo_longitude) : null;
    if ((latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      setError(t.geoInvalid);
      return;
    }

    if (form.geoOrderRestrictionEnabled && (latitude == null || longitude == null)) {
      setError(t.geoRestrictionCoordsRequired);
      return;
    }

    const orderRadiusMeters = parseOrderRadiusInput(form.order_radius_meters);
    if (orderRadiusMeters == null) {
      setError(
        t.orderRadiusInvalid
          .replace('{min}', String(MIN_ORDER_RADIUS_METERS))
          .replace('{max}', String(MAX_ORDER_RADIUS_METERS)),
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        countryCode: form.countryCode,
        geo_latitude: form.geo_latitude.trim(),
        geo_longitude: form.geo_longitude.trim(),
        order_radius_meters: String(orderRadiusMeters),
        geo_order_restriction_enabled: form.geoOrderRestrictionEnabled,
        business_hours: hours,
        storefront_intro: intro,
      };
      const res = await fetch('/api/restaurant/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (json.error === 'migration_required') setError(t.migrationRequired);
        else if (json.error === 'geo_invalid') setError(t.geoInvalid);
        else if (json.error === 'geo_coords_required') setError(t.geoRestrictionCoordsRequired);
        else if (json.error === 'order_radius_invalid') {
          setError(
            t.orderRadiusInvalid
              .replace('{min}', String(MIN_ORDER_RADIUS_METERS))
              .replace('{max}', String(MAX_ORDER_RADIUS_METERS)),
          );
        } else if (json.error === 'invalid_country_code') setError(t.countryCodeInvalid);
        else setError(t.saveFail);
        return;
      }

      router.refresh();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError(t.saveFail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {!embedded && (
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.desc}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="w-full space-y-4">
        <div className={dashboardStickyToolbarShellClass}>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {error ? (
              <p className="mesa-alert-danger order-first mr-auto w-full px-3 py-1.5 text-sm sm:w-auto">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="order-first mr-auto w-full rounded-lg border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-sm text-green-400 sm:w-auto">
                ✓ {t.saved}
              </p>
            ) : null}
            <Button type="submit" loading={saving} className="w-full sm:w-auto">
              {t.save}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-border bg-brand-card p-6">
          <div className="space-y-5">
            <Input
              label={t.name}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Casa Portuguesa"
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-brand-text-muted">{t.slug}</label>
              <div className="rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm text-brand-text-muted">
                {restaurant.slug}
              </div>
              <p className="mt-1 text-[13px] text-brand-text-muted">{t.slugTip}</p>
            </div>

            <Input
              label={t.address}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Rua da Alegria 123, Lisboa"
            />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Input
                label={t.phone}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+351 21 123 4567"
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-text-muted">
                  {t.countryCode}
                </label>
                <select
                  value={form.countryCode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      countryCode: e.target.value as RestaurantCountryCode,
                    }))
                  }
                  className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-base text-brand-text"
                >
                  {RESTAURANT_COUNTRY_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[13px] text-brand-text-muted">{t.countryCodeHint}</p>
              </div>
            </div>

            <RestaurantStorefrontSettingsSection
              logoUrl={logoUrl}
              coverUrl={coverUrl}
              intro={intro}
              hours={hours}
              onIntroChange={setIntro}
              onHoursChange={setHours}
              onImageUrlChange={(kind, url) => {
                if (kind === 'logo') setLogoUrl(url);
                else setCoverUrl(url);
              }}
              copy={{
                storefrontSectionTitle: t.storefrontSectionTitle,
                storefrontSectionDesc: t.storefrontSectionDesc,
                logo: t.storefrontLogo,
                cover: t.storefrontCover,
                upload: t.storefrontUpload,
                removeImage: t.storefrontRemoveImage,
                imageUploading: t.storefrontImageUploading,
                imageFail: t.storefrontImageFail,
                imageTooLarge: t.storefrontImageTooLarge,
                introPt: t.storefrontIntroPt,
                introEn: t.storefrontIntroEn,
                introZh: t.storefrontIntroZh,
                introHint: t.storefrontIntroHint,
                hoursTitle: t.storefrontHoursTitle,
                hoursHint: t.storefrontHoursHint,
                hoursOpen: t.storefrontHoursOpen,
                hoursClose: t.storefrontHoursClose,
                hoursClosed: t.storefrontHoursClosed,
                hoursOpenDay: t.storefrontHoursOpenDay,
                hoursAddWindow: t.storefrontHoursAddWindow,
                hoursRemoveWindow: t.storefrontHoursRemoveWindow,
                hoursApplyWeekdays: t.storefrontHoursApplyWeekdays,
                hoursApplyAll: t.storefrontHoursApplyAll,
                weekdayLabels: {
                  '1': t.storefrontWeekday1,
                  '2': t.storefrontWeekday2,
                  '3': t.storefrontWeekday3,
                  '4': t.storefrontWeekday4,
                  '5': t.storefrontWeekday5,
                  '6': t.storefrontWeekday6,
                  '7': t.storefrontWeekday7,
                },
              }}
            />

            <fieldset className="space-y-3 rounded-xl border border-brand-border/70 bg-brand-bg/40 p-4">
              <legend className="px-1 text-sm font-medium text-brand-text">{t.geoSectionTitle}</legend>
              <label className="flex cursor-pointer select-none items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.geoOrderRestrictionEnabled}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, geoOrderRestrictionEnabled: e.target.checked }))
                  }
                  className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-brand-text">
                    {t.geoRestrictionEnabled}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-brand-text-muted">
                    {t.geoRestrictionEnabledDesc}
                  </span>
                </span>
              </label>
              <div
                className={`space-y-3 ${form.geoOrderRestrictionEnabled ? '' : 'opacity-60'}`}
                aria-disabled={!form.geoOrderRestrictionEnabled}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label={t.geoLatitude}
                    value={form.geo_latitude}
                    onChange={(e) => setForm((f) => ({ ...f, geo_latitude: e.target.value }))}
                    placeholder="38.7223"
                  />
                  <Input
                    label={t.geoLongitude}
                    value={form.geo_longitude}
                    onChange={(e) => setForm((f) => ({ ...f, geo_longitude: e.target.value }))}
                    placeholder="-9.1393"
                  />
                </div>
                <p className="text-[13px] leading-relaxed text-brand-text-muted">{t.geoHint}</p>
                <div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!navigator.geolocation) {
                        setError(t.geoLocateFail);
                        return;
                      }
                      try {
                        const position = await getCurrentPositionWithFallback();
                        setForm((prev) => ({
                          ...prev,
                          geo_latitude: position.coords.latitude.toFixed(6),
                          geo_longitude: position.coords.longitude.toFixed(6),
                        }));
                        setError('');
                      } catch {
                        setError(t.geoLocateFail);
                      }
                    }}
                    className="text-[13px] font-medium text-brand-gold hover:underline"
                  >
                    {t.useCurrentLocation}
                  </button>
                </div>
                <Input
                  label={t.orderRadiusMeters}
                  type="number"
                  min={MIN_ORDER_RADIUS_METERS}
                  max={MAX_ORDER_RADIUS_METERS}
                  step={1}
                  inputMode="numeric"
                  value={form.order_radius_meters}
                  onChange={(e) => setForm((f) => ({ ...f, order_radius_meters: e.target.value }))}
                  placeholder={String(MIN_ORDER_RADIUS_METERS)}
                />
                <p className="text-[13px] text-brand-text-muted">
                  {t.orderRadiusHint
                    .replace('{min}', String(MIN_ORDER_RADIUS_METERS))
                    .replace('{max}', String(MAX_ORDER_RADIUS_METERS))}
                </p>
              </div>
            </fieldset>
          </div>
        </div>
      </form>

      <div className="mt-4 rounded-2xl border border-red-500/20 bg-brand-card p-6">
        <h2 className="mesa-text-danger mb-2 font-medium">{t.danger}</h2>
        <p className="mb-4 text-sm text-brand-text-muted">{t.dangerTip}</p>
        <a
          href={`/${restaurant.slug}/kitchen`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-brand-gold hover:underline"
        >
          → {t.openKitchen}
        </a>
      </div>
    </div>
  );
}
