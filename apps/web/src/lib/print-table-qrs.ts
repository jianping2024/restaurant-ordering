import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export type PrintTableQrsLabels = {
  title: string;
  table: string;
  printOne: string;
  printMany: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printTableQrs(options: {
  restaurantName: string;
  rows: RestaurantTableRow[];
  stickerDataUrls: Record<string, string>;
  labels: PrintTableQrsLabels;
}): boolean {
  const { restaurantName, rows, stickerDataUrls, labels } = options;
  const printable = rows.filter((row) => stickerDataUrls[row.id]);
  if (printable.length === 0) return false;

  const win = window.open('', '_blank');
  if (!win) return false;

  const single = printable.length === 1;
  const printActionLabel = single ? labels.printOne : labels.printMany;

  win.document.write(`
    <html>
      <head>
        <title>${escapeHtml(restaurantName)} — ${escapeHtml(single ? `${labels.table} ${printable[0].display_name}` : labels.title)}</title>
        <style>
          body { font-family: serif; background: white; margin: 0; padding: 20px; }
          .grid { display: grid; grid-template-columns: ${single ? '1fr' : 'repeat(3, 1fr)'}; gap: 20px; ${single ? 'max-width: 420px; margin: 0 auto;' : ''} }
          .item { text-align: center; page-break-inside: avoid; }
          .item img { width: 100%; max-width: 400px; height: auto; display: inline-block; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 16px;">${escapeHtml(printActionLabel)}</button>
        <div class="grid">
          ${printable
            .map((row) => {
              const stickerSrc = stickerDataUrls[row.id];
              return `
            <div class="item">
              <img src="${stickerSrc}" alt="${escapeHtml(`${labels.table} ${row.display_name}`)}" />
            </div>
          `;
            })
            .join('')}
        </div>
      </body>
    </html>
  `);
  win.document.close();
  return true;
}
