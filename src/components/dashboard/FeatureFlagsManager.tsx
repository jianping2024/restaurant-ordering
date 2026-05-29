'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  groupRestaurantFeaturesByModule,
  type ResolvedRestaurantFeatureFlags,
} from '@/lib/restaurant-features';

type Props = {
  embedded?: boolean;
  initialFlags: ResolvedRestaurantFeatureFlags;
};

export function FeatureFlagsManager({ embedded, initialFlags }: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).featureSettings;
  const [flags, setFlags] = useState(initialFlags);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/restaurant/features', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flags }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (json.error === 'migration_required') setError(t.migrationRequired);
        else setError(t.saveFail);
        return;
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError(t.saveFail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {!embedded ? (
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.desc}</p>
        </div>
      ) : null}

      <div className="space-y-6">
        {groupRestaurantFeaturesByModule().map(({ module, features }) => (
          <section key={module.id}>
            <h2 className="text-sm font-medium text-brand-text mb-2">{t[module.labelKey]}</h2>
            <div className="bg-brand-card border border-brand-border rounded-xl divide-y divide-brand-border">
              {features.map((def) => (
                <label
                  key={def.key}
                  className="flex items-start gap-3 px-4 py-4 cursor-pointer select-none hover:bg-brand-border/20 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={flags[def.key]}
                    onChange={(e) =>
                      setFlags((prev) => ({ ...prev, [def.key]: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
                  />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-brand-text">
                      {t[def.labelKey]}
                    </span>
                    <span className="block text-[13px] text-brand-text-muted mt-0.5">
                      {t[def.descKey]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-status-danger">{error}</p> : null}
      {success ? (
        <p className="mt-3 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-2">
          ✓ {t.saved}
        </p>
      ) : null}

      <div className="mt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </div>
  );
}
