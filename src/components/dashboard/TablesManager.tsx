'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

interface TablesManagerProps {
  restaurant: { id: string; slug: string; name: string };
}

export function TablesManager({ restaurant }: TablesManagerProps) {
  const { lang } = useLanguage();
  const [tableCount, setTableCount] = useState(10);
  const t = getMessages(lang).tables;

  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // 生成所有二维码
  useEffect(() => {
    const generate = async () => {
      const codes: Record<number, string> = {};
      for (let i = 1; i <= tableCount; i++) {
        const url = `${baseUrl}/${restaurant.slug}/menu?table=${i}`;
        codes[i] = await QRCode.toDataURL(url, {
          width: 200,
          margin: 2,
          color: { dark: '#0f0e0c', light: '#f5f0e8' },
        });
      }
      setQrCodes(codes);
    };
    generate();
  }, [tableCount, restaurant.slug, baseUrl]);

  // 下载单个二维码
  const downloadQR = (tableNum: number) => {
    const link = document.createElement('a');
    link.href = qrCodes[tableNum];
    link.download = `table-${tableNum}-qr.png`;
    link.click();
  };

  // 打印全部二维码
  const printAll = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const items = Array.from({ length: tableCount }, (_, i) => i + 1);
    win.document.write(`
      <html>
        <head>
          <title>${restaurant.name} — ${t.title}</title>
          <style>
            body { font-family: serif; background: white; margin: 0; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .item { text-align: center; page-break-inside: avoid; border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            .item img { width: 150px; height: 150px; }
            h2 { font-size: 14px; margin: 8px 0 4px; }
            p { font-size: 11px; color: #666; margin: 0; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 16px;">${t.print}</button>
          <div class="grid">
            ${items.map(n => `
              <div class="item">
                <img src="${qrCodes[n] || ''}" alt="${t.table} ${n}" />
                <h2>${restaurant.name}</h2>
                <p>${t.table} ${n}</p>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.desc}</p>
        </div>
        <Button onClick={printAll} variant="outline">🖨️ {t.print}</Button>
      </div>

      {/* 桌位数量设置 */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
        <label className="text-sm text-brand-text-muted font-medium block mb-3">{t.count}</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={30}
            value={tableCount}
            onChange={e => setTableCount(Number(e.target.value))}
            className="flex-1 accent-brand-gold"
          />
          <span className="text-brand-gold font-heading text-2xl w-10 text-center">{tableCount}</span>
        </div>
      </div>

      {/* 二维码网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: tableCount }, (_, i) => i + 1).map(tableNum => (
          <div
            key={tableNum}
            className="bg-brand-card border border-brand-border rounded-2xl p-4 text-center"
          >
            <p className="text-brand-gold font-heading text-lg mb-3">{t.table} {tableNum}</p>
            {qrCodes[tableNum] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCodes[tableNum]}
                alt={`${t.table} ${tableNum} QR`}
                className="mx-auto rounded-lg mb-3 w-32 h-32"
              />
            ) : (
              <div className="w-32 h-32 mx-auto bg-brand-border rounded-lg mb-3 animate-pulse" />
            )}
            <p className="text-brand-text-muted text-xs mb-3 truncate">
              /{restaurant.slug}/menu?table={tableNum}
            </p>
            <button
              onClick={() => downloadQR(tableNum)}
              disabled={!qrCodes[tableNum]}
              className="text-xs text-brand-gold hover:underline disabled:opacity-50"
            >
              {t.download}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
