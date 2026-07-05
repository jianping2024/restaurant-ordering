'use client';

import { useStaffLoginQr } from '@/lib/use-table-qr-codes';
import { buildStaffLoginQrUrl } from '@/lib/table-menu-qr';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

export function StaffLoginQrSection({ slug }: { slug: string }) {
  const { lang } = useLanguage();
  const t = getMessages(lang).tables;
  const staffLoginQr = useStaffLoginQr(slug);

  const downloadStaffLoginQR = () => {
    if (!staffLoginQr) return;
    const link = document.createElement('a');
    link.href = staffLoginQr;
    link.download = 'staff-login-qr.png';
    link.click();
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
      <h2 className="font-heading text-2xl text-brand-gold mb-2">{t.staffTitle}</h2>
      <p className="text-brand-text-muted text-sm mb-5">{t.staffDesc}</p>
      <div className="max-w-sm mx-auto border border-brand-border rounded-xl p-4 text-center">
        {staffLoginQr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staffLoginQr} alt={t.staffAlt} className="mx-auto rounded-lg mb-3 w-44 h-44" />
        ) : (
          <div className="w-44 h-44 mx-auto bg-brand-border rounded-lg mb-3 animate-pulse" />
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={downloadStaffLoginQR}
            disabled={!staffLoginQr}
            className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
          >
            {t.downloadStaff}
          </button>
          <a
            href={buildStaffLoginQrUrl(slug)}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-brand-gold hover:underline"
          >
            {t.openStaffLogin}
          </a>
        </div>
      </div>
    </div>
  );
}
