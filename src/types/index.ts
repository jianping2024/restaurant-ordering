// ============================================================
// 全局类型定义
// ============================================================

export type Plan = 'free' | 'pro';
export type OrderStatus = 'pending' | 'cooking' | 'done';
export type OrderItemStatus = 'pending' | 'cooking' | 'done';
export type Category = 'Entradas' | 'Pratos' | 'Bebidas' | 'Sobremesas';
export type SplitMode = 'even' | 'by_item' | 'custom';
export type BillStatus = 'pending' | 'confirmed';
export type Language = 'pt' | 'en' | 'zh';

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  plan: Plan;
  kitchen_password: string;
  created_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name_pt: string;
  name_en?: string;
  name_zh?: string;
  description_pt?: string;
  description_en?: string;
  price: number;
  category: Category;
  emoji: string;
  available: boolean;
  sort_order: number;
  created_at: string;
}

export interface OrderItem {
  id: string;         // menu_item.id
  name: string;       // 显示名称（根据语言）
  name_pt: string;
  qty: number;
  note?: string;
  price: number;
  emoji: string;
  item_status?: OrderItemStatus; // 菜品级出餐状态
  started_at?: string;
  done_at?: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_number: number;
  status: OrderStatus;
  items: OrderItem[];
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface SplitPerson {
  name: string;
  items?: string[];  // by_item 模式：菜品 id 列表
  amount?: number;   // custom 模式：手动金额
}

export interface SplitResult {
  name: string;
  amount: number;
  items?: { name: string; qty: number; price: number }[];
}

export interface BillSplit {
  id: string;
  restaurant_id: string;
  table_number: number;
  order_ids: string[];
  split_mode: SplitMode;
  persons: SplitPerson[];
  result: SplitResult[];
  total_amount: number;
  status: BillStatus;
  created_at: string;
}

// 购物车条目
export interface CartItem {
  menuItemId: string;
  name_pt: string;
  name_en?: string;
  name_zh?: string;
  price: number;
  emoji: string;
  qty: number;
  note?: string;
}
