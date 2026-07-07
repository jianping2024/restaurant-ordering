export const PREVIEW_RESTAURANT_NAME = 'MesaGo 演示';

export const PREVIEW_TABLE = {
  displayName: '8',
  adults: 3,
  children: 1,
  adultPrice: 19.95,
  childPrice: 10,
  buffetName: '午市自助',
} as const;

export type PreviewMenuCategory = '饮料' | '水果酒';

export type PreviewMenuItem = {
  code: string;
  nameZh: string;
  namePt: string;
  nameEn: string;
  price: number;
  category: PreviewMenuCategory;
  outlet: '吧台';
};

/** Pirata-style drinks menu (出品档口：吧台). */
export const PREVIEW_MENU_CATEGORIES = ['饮料', '水果酒'] as const satisfies readonly PreviewMenuCategory[];

export const PREVIEW_MENU_ITEMS: readonly PreviewMenuItem[] = [
  {
    code: '006',
    nameZh: '可乐',
    namePt: 'Cola',
    nameEn: 'Cola',
    price: 2.2,
    category: '饮料',
    outlet: '吧台',
  },
  {
    code: '011',
    nameZh: 'Sumol 汽水',
    namePt: 'Sumol laranja',
    nameEn: 'Orange juice',
    price: 2.2,
    category: '饮料',
    outlet: '吧台',
  },
  {
    code: '031',
    nameZh: 'Guaraná',
    namePt: 'Guaraná',
    nameEn: 'Guaraná',
    price: 2.2,
    category: '饮料',
    outlet: '吧台',
  },
  {
    code: '013',
    nameZh: '7up',
    namePt: '7 up',
    nameEn: '7 up',
    price: 2.2,
    category: '饮料',
    outlet: '吧台',
  },
  {
    code: '005',
    nameZh: '鲜榨橙汁',
    namePt: 'Sumo Laranja Natural',
    nameEn: 'Fresh orange juice',
    price: 3.5,
    category: '饮料',
    outlet: '吧台',
  },
  {
    code: '007',
    nameZh: 'Cola Zero',
    namePt: 'Cola Zero',
    nameEn: 'Cola Zero',
    price: 2.2,
    category: '饮料',
    outlet: '吧台',
  },
  {
    code: '301',
    nameZh: 'Montanha',
    namePt: 'Montanha',
    nameEn: 'Montanha',
    price: 14.9,
    category: '水果酒',
    outlet: '吧台',
  },
  {
    code: '302',
    nameZh: 'Alianca Meio Seco',
    namePt: 'Alianca Meio Seco',
    nameEn: 'Alianca Meio Seco',
    price: 14.9,
    category: '水果酒',
    outlet: '吧台',
  },
  {
    code: '303',
    nameZh: 'Alianca Bruto',
    namePt: 'Alianca Bruto',
    nameEn: 'Alianca Bruto',
    price: 14.9,
    category: '水果酒',
    outlet: '吧台',
  },
  {
    code: '304',
    nameZh: 'Alianca Doce',
    namePt: 'Alianca Doce',
    nameEn: 'Alianca Doce',
    price: 14.9,
    category: '水果酒',
    outlet: '吧台',
  },
  {
    code: '305',
    nameZh: 'Raposeira Doce',
    namePt: 'Raposeira Doce',
    nameEn: 'Raposeira Doce',
    price: 19.9,
    category: '水果酒',
    outlet: '吧台',
  },
] as const;

const PREVIEW_MENU_BY_CODE = new Map(PREVIEW_MENU_ITEMS.map((item) => [item.code, item]));

export function previewMenuItemsByCategory(category: PreviewMenuCategory): PreviewMenuItem[] {
  return PREVIEW_MENU_ITEMS.filter((item) => item.category === category);
}

/** Compact list for the phone preview (饮料 tab active). */
export const PREVIEW_MENU_PHONE_ITEMS = previewMenuItemsByCategory('饮料');

export type PreviewCartLine = {
  code: string;
  qty: number;
};

export const PREVIEW_CART_LINES: readonly PreviewCartLine[] = [
  { code: '006', qty: 1 },
  { code: '011', qty: 1 },
] as const;

export function previewCartTotal(lines: readonly PreviewCartLine[]): number {
  return lines.reduce((sum, line) => {
    const item = PREVIEW_MENU_BY_CODE.get(line.code);
    return item ? sum + item.price * line.qty : sum;
  }, 0);
}

export const PREVIEW_CART_TOTAL = previewCartTotal(PREVIEW_CART_LINES);

export const PREVIEW_BAR_ORDERS = [
  {
    table: '8',
    status: 'pending' as const,
    items: ['可乐 ×2', '鲜榨橙汁 ×1'],
  },
  {
    table: '2',
    status: 'preparing' as const,
    items: ['Montanha ×1'],
  },
] as const;

export const PREVIEW_BILL = {
  buffetTotal: 69.85,
  addOnTotal: 7.9,
  grandTotal: 77.75,
  splitMode: 'even' as const,
  guests: 4,
} as const;

export const PREVIEW_DASHBOARD = {
  todayOrders: 42,
  todayRevenue: 1286.5,
  topItems: [
    { name: '可乐', qty: 86 },
    { name: 'Guaraná', qty: 64 },
    { name: '鲜榨橙汁', qty: 38 },
  ],
} as const;
