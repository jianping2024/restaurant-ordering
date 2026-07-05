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
  qrCodes: Record<string, string>;
  groupNameByTableId: Record<string, string>;
  labels: PrintTableQrsLabels;
}): boolean {
  const { restaurantName, rows, qrCodes, groupNameByTableId, labels } = options;
  const printable = rows.filter((row) => qrCodes[row.id]);
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
          .grid { display: grid; grid-template-columns: ${single ? '1fr' : 'repeat(3, 1fr)'}; gap: 20px; ${single ? 'max-width: 320px; margin: 0 auto;' : ''} }
          .item { text-align: center; page-break-inside: avoid; border: 1px solid #ddd; padding: 20px 16px; border-radius: 8px; }
          .item img { width: ${single ? '200px' : '150px'}; height: ${single ? '200px' : '150px'}; }
          .item-single { padding: 28px 24px; max-width: 320px; margin: 0 auto; }
          .table-no-large { font-size: 42px; font-weight: 700; margin: 0 0 8px; line-height: 1.1; letter-spacing: 0.02em; }
          .group-name { font-size: 18px; margin: 0 0 16px; color: #666; }
          h2 { font-size: 13px; margin: 14px 0 0; color: #444; font-weight: normal; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 16px;">${escapeHtml(printActionLabel)}</button>
        <div class="grid">
          ${printable
            .map((row) => {
              const qrSrc = qrCodes[row.id];
              const groupName = groupNameByTableId[row.id];
              return `
            <div class="item${single ? ' item-single' : ''}">
              <p class="table-no-large">${escapeHtml(row.display_name)}</p>
              ${groupName ? `<p class="group-name">${escapeHtml(groupName)}</p>` : ''}
              <img src="${qrSrc}" alt="${escapeHtml(`${labels.table} ${row.display_name}`)}" />
              <h2>${escapeHtml(restaurantName)}</h2>
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
