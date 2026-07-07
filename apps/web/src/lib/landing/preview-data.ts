export const PREVIEW_RESTAURANT_NAME = 'MesaGo 演示';

export const PREVIEW_TABLE = {
  displayName: '8',
  adults: 3,
  children: 1,
  adultPrice: 19.95,
  childPrice: 10,
  buffetName: '午市自助',
} as const;

export const PREVIEW_MENU_CATEGORIES = ['主菜', '饮品'] as const;

export const PREVIEW_MENU_ITEMS = [
  { name: '宫保鸡丁', price: 8.5, category: '主菜' },
  { name: '扬州炒饭', price: 6.0, category: '主菜' },
  { name: '珍珠奶茶', price: 3.5, category: '饮品' },
] as const;

export const PREVIEW_KITCHEN_ORDERS = [
  {
    table: '8',
    status: 'pending' as const,
    items: ['宫保鸡丁 ×1', '扬州炒饭 ×1'],
  },
  {
    table: '2',
    status: 'cooking' as const,
    items: ['蒜蓉西兰花 ×2'],
  },
] as const;

export const PREVIEW_BILL = {
  buffetTotal: 69.85,
  addOnTotal: 18.0,
  grandTotal: 87.85,
  splitMode: 'even' as const,
  guests: 4,
} as const;

export const PREVIEW_DASHBOARD = {
  todayOrders: 42,
  todayRevenue: 1286.5,
  topDishes: [
    { name: '宫保鸡丁', qty: 28 },
    { name: '扬州炒饭', qty: 21 },
    { name: '珍珠奶茶', qty: 16 },
  ],
} as const;
