'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Restaurant } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

export function SettingsForm({
  restaurant,
  embedded,
}: {
  restaurant: Restaurant;
  embedded?: boolean;
}) {
  const { lang } = useLanguage();
  const t = getMessages(lang).settings;
  const [form, setForm] = useState({
    name: restaurant.name,
    address: restaurant.address || '',
    phone: restaurant.phone || '',
    geo_latitude: restaurant.geo_latitude != null ? String(restaurant.geo_latitude) : '',
    geo_longitude: restaurant.geo_longitude != null ? String(restaurant.geo_longitude) : '',
    kitchen_password: restaurant.kitchen_password,
    waiter_password: restaurant.waiter_password || '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

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
    if (!/^\d{4}$/.test(form.kitchen_password)) {
      setError(t.kitchenPwd);
      return;
    }
    if (!/^\d{4}$/.test(form.waiter_password)) {
      setError(t.waiterPwd);
      return;
    }
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

    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: form.name.trim(),
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          geo_latitude: latitude,
          geo_longitude: longitude,
          kitchen_password: form.kitchen_password,
          waiter_password: form.waiter_password,
        })
        .eq('id', restaurant.id);

      if (error) throw error;
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

      <div className="max-w-lg">
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
            <div className="flex items-center justify-between gap-3 -mt-2">
              <p className="text-[13px] text-brand-text-muted">{t.geoHint}</p>
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
                className="text-[13px] text-brand-gold hover:underline whitespace-nowrap"
              >
                {t.useCurrentLocation}
              </button>
            </div>

            <div>
              <Input
                label={t.kitchenLabel}
                type="text"
                maxLength={4}
                pattern="\d{4}"
                value={form.kitchen_password}
                onChange={e => setForm(f => ({ ...f, kitchen_password: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder="1234"
              />
              <p className="text-[13px] text-brand-text-muted mt-1">
                {t.kitchenTip}
              </p>
            </div>

            <div>
              <Input
                label={t.waiterLabel}
                type="text"
                maxLength={4}
                pattern="\d{4}"
                value={form.waiter_password}
                onChange={e => setForm(f => ({ ...f, waiter_password: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder="5678"
              />
              <p className="text-[13px] text-brand-text-muted mt-1">
                {t.waiterTip}
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
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
          <h2 className="text-red-400 font-medium mb-2">{t.danger}</h2>
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
