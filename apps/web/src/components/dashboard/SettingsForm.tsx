'use client';

import { useState } from 'react';
import { RESTAURANT_COUNTRY_OPTIONS, type RestaurantCountryCode } from '@mesa/shared';
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

export function SettingsForm({
  restaurant,
  embedded,
}: {
  restaurant: RestaurantSettingsProfile;
  embedded?: boolean;
}) {
  const { lang } = useLanguage();
  const t = getMessages(lang).settings;
  const [form, setForm] = useState({
    name: restaurant.name,
    address: restaurant.address || '',
    phone: restaurant.phone || '',
    countryCode: (restaurant.country_code || 'PT') as RestaurantCountryCode,
    geo_latitude: restaurant.geo_latitude != null ? String(restaurant.geo_latitude) : '',
    geo_longitude: restaurant.geo_longitude != null ? String(restaurant.geo_longitude) : '',
    order_radius_meters: String(normalizeOrderRadiusMeters(restaurant.order_radius_meters)),
  });
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
      const payload: Record<string, string> = {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        countryCode: form.countryCode,
        geo_latitude: form.geo_latitude.trim(),
        geo_longitude: form.geo_longitude.trim(),
        order_radius_meters: String(orderRadiusMeters),
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

      <div className="w-full">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <Input
              label={t.name}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Casa Portuguesa"
            />

            <div>
              <label className="text-sm text-brand-text-muted font-medium block mb-1.5">{t.slug}</label>
              <div className="bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-text-muted text-sm">
                {restaurant.slug}
              </div>
              <p className="text-[13px] text-brand-text-muted mt-1">{t.slugTip}</p>
            </div>

            <Input
              label={t.address}
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Rua da Alegria 123, Lisboa"
            />
            <Input
              label={t.phone}
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+351 21 123 4567"
            />

            <div>
              <label className="text-sm text-brand-text-muted font-medium block mb-1.5">
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
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-text text-sm"
              >
                {RESTAURANT_COUNTRY_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[13px] text-brand-text-muted mt-1">{t.countryCodeHint}</p>
            </div>

            <fieldset className="space-y-3 rounded-xl border border-brand-border/70 bg-brand-bg/40 p-4">
              <legend className="text-sm font-medium text-brand-text px-1">{t.geoSectionTitle}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={t.geoLatitude}
                  value={form.geo_latitude}
                  onChange={e => setForm(f => ({ ...f, geo_latitude: e.target.value }))}
                  placeholder="38.7223"
                />
                <Input
                  label={t.geoLongitude}
                  value={form.geo_longitude}
                  onChange={e => setForm(f => ({ ...f, geo_longitude: e.target.value }))}
                  placeholder="-9.1393"
                />
              </div>
              <p className="text-[13px] text-brand-text-muted leading-relaxed">{t.geoHint}</p>
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
            </fieldset>

            {error && (
              <p className="mesa-alert-danger text-sm px-4 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-2">
                ✓ {t.saved}
              </p>
            )}

            <Button type="submit" loading={saving} className="w-full sm:w-auto">{t.save}</Button>
          </form>
        </div>

        {/* 危险操作区域 */}
        <div className="bg-brand-card border border-red-500/20 rounded-2xl p-6 mt-4">
          <h2 className="mesa-text-danger font-medium mb-2">{t.danger}</h2>
          <p className="text-brand-text-muted text-sm mb-4">{t.dangerTip}</p>
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
    </div>
  );
}
