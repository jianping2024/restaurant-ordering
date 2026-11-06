'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export type ClearBusinessDataCopy = {
  title: string;
  desc: string;
  slugLabel: string;
  slugPlaceholder: string;
  openConfirm: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
  cancelLabel: string;
  success: string;
  fail: string;
  slugMismatch: string;
  ownerOnly: string;
  fiscalTimeout: string;
  fiscalFail: string;
};

export function ClearBusinessDataSection({
  slug,
  isOwner,
  copy,
}: {
  slug: string;
  isOwner: boolean;
  copy: ClearBusinessDataCopy;
}) {
  const [confirmSlug, setConfirmSlug] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const slugMatches = confirmSlug.trim().toLowerCase() === slug.toLowerCase();

  const runClear = async () => {
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      const trimmed = confirmSlug.trim();
      const res = await fetch('/api/restaurant/clear-business-data', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmSlug: trimmed,
          confirmPhrase: trimmed,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        if (json.error === 'slug_mismatch') setError(copy.slugMismatch);
        else if (json.error === 'owner_only') setError(copy.ownerOnly);
        else if (json.error === 'fiscal_clear_timeout') setError(copy.fiscalTimeout);
        else if (
          json.error === 'fiscal_clear_failed' ||
          json.error === 'fiscal_clear_enqueue_failed'
        ) {
          setError(copy.fiscalFail);
        } else setError(copy.fail);
        setConfirmOpen(false);
        return;
      }
      setSuccess(true);
      setConfirmSlug('');
      setConfirmOpen(false);
    } catch {
      setError(copy.fail);
      setConfirmOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) return null;

  return (
    <section className="mt-8 rounded-2xl border border-red-500/40 bg-brand-card p-6">
      <h2 className="text-base font-medium text-red-400">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-brand-text-muted whitespace-pre-wrap">
        {copy.desc}
      </p>

      <div className="mt-4">
        <Input
          label={copy.slugLabel.replace('{slug}', slug)}
          value={confirmSlug}
          onChange={(e) => {
            setConfirmSlug(e.target.value);
            setError('');
            setSuccess(false);
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder={copy.slugPlaceholder.replace('{slug}', slug)}
        />
      </div>

      <Button
        type="button"
        variant="danger"
        className="mt-4"
        disabled={loading || !slugMatches}
        onClick={() => setConfirmOpen(true)}
      >
        {copy.openConfirm}
      </Button>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-green-400">✓ {copy.success}</p> : null}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
        title={copy.confirmTitle}
        message={copy.confirmMessage}
        confirmLabel={copy.confirmLabel}
        cancelLabel={copy.cancelLabel}
        variant="danger"
        confirming={loading}
        onConfirm={() => void runClear()}
      />
    </section>
  );
}
