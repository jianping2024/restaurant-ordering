/** Language-neutral demo facts for landing product previews. */

export const PREVIEW_TABLE = {
  displayName: '8',
  adults: 3,
  children: 1,
  adultPrice: 19.95,
  childPrice: 10,
} as const;

export type PreviewMenuCategoryId = 'drinks' | 'fruit-wine';

export type PreviewBarStatusId = 'pending' | 'preparing';

/** Aligns with product menu name fields for `resolveMenuItemLocalizedName`. */
export type PreviewMenuItem = {
  code: string;
  name_pt: string;
  name_en: string;
  name_zh: string;
  price: number;
  category: PreviewMenuCategoryId;
};

export const PREVIEW_MENU_CATEGORIES = [
  'drinks',
  'fruit-wine',
] as const satisfies readonly PreviewMenuCategoryId[];

export const PREVIEW_MENU_ITEMS: readonly PreviewMenuItem[] = [
  {
    code: '011',
    name_zh: 'Sumol 汽水',
    name_pt: 'Sumol laranja',
    name_en: 'Sumol orange',
    price: 2.2,
    category: 'drinks',
  },
  {
    code: '005',
    name_zh: '鲜榨橙汁',
    name_pt: 'Sumo Laranja Natural',
    name_en: 'Fresh orange juice',
    price: 3.5,
    category: 'drinks',
  },
  {
    code: '007',
    name_zh: 'Cola Zero',
    name_pt: 'Cola Zero',
    name_en: 'Cola Zero',
    price: 2.2,
    category: 'drinks',
  },
  {
    code: '301',
    name_zh: 'Montanha',
    name_pt: 'Montanha',
    name_en: 'Montanha',
    price: 14.9,
    category: 'fruit-wine',
  },
  {
    code: '302',
    name_zh: 'Alianca Meio Seco',
    name_pt: 'Alianca Meio Seco',
    name_en: 'Alianca Meio Seco',
    price: 14.9,
    category: 'fruit-wine',
  },
  {
    code: '303',
    name_zh: 'Alianca Bruto',
    name_pt: 'Alianca Bruto',
    name_en: 'Alianca Bruto',
    price: 14.9,
    category: 'fruit-wine',
  },
];

const PREVIEW_MENU_BY_CODE = new Map(PREVIEW_MENU_ITEMS.map((item) => [item.code, item]));

export function getPreviewMenuItem(code: string): PreviewMenuItem | undefined {
  return PREVIEW_MENU_BY_CODE.get(code);
}

export function previewMenuItemsByCategory(category: PreviewMenuCategoryId): PreviewMenuItem[] {
  return PREVIEW_MENU_ITEMS.filter((item) => item.category === category);
}

/** Compact list for the phone preview (drinks tab active). */
export const PREVIEW_MENU_PHONE_ITEMS = previewMenuItemsByCategory('drinks');

export type PreviewCartLine = {
  code: string;
  qty: number;
};

export const PREVIEW_CART_LINES: readonly PreviewCartLine[] = [
  { code: '005', qty: 1 },
  { code: '011', qty: 1 },
] as const;

export function previewCartTotal(lines: readonly PreviewCartLine[]): number {
  return lines.reduce((sum, line) => {
    const item = PREVIEW_MENU_BY_CODE.get(line.code);
    return item ? sum + item.price * line.qty : sum;
  }, 0);
}

export const PREVIEW_CART_TOTAL = previewCartTotal(PREVIEW_CART_LINES);

export type PreviewBarOrderLine = {
  code: string;
  qty: number;
};

export type PreviewBarOrder = {
  table: string;
  status: PreviewBarStatusId;
  lines: readonly PreviewBarOrderLine[];
};

export const PREVIEW_BAR_ORDERS: readonly PreviewBarOrder[] = [
  {
    table: '8',
    status: 'pending',
    lines: [
      { code: '007', qty: 2 },
      { code: '005', qty: 1 },
    ],
  },
  {
    table: '2',
    status: 'preparing',
    lines: [{ code: '301', qty: 1 }],
  },
];

export const PREVIEW_BILL = {
  buffetTotal: 69.85,
  addOnTotal: 7.9,
  grandTotal: 77.75,
  guests: 4,
} as const;

export type PreviewDashboardTopItem = {
  code: string;
  qty: number;
};

export const PREVIEW_DASHBOARD = {
  todayOrders: 42,
  todayRevenue: 1286.5,
  topItems: [
    { code: '007', qty: 86 },
    { code: '011', qty: 64 },
    { code: '005', qty: 38 },
  ] as const satisfies readonly PreviewDashboardTopItem[],
};
