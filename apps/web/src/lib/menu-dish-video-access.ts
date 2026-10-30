import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isRestaurantFeatureEnabled } from '@/lib/restaurant-features';
import { can, type Capabilities } from '@/lib/permissions/can';
import {
  DISH_VIDEO_GATE_RESTAURANT_COLUMNS,
  type DishVideoGateRestaurant,
} from '@/lib/menu-dish-video';
import { loadPlatformProSettings, resolvePremiumGate } from '@/lib/premium/access';


export type DishVideoAccess = {
  /** Platform Pro `menu_dish_video` is effective for this restaurant. */
  pro: boolean;
  /** Pro + staff capability `dashboard.menu.video.manage` → may generate/change videos. */
  canManage: boolean;
  /** Pro + store switch `menu_dish_video_enabled` → guests see videos. */
  guestVisible: boolean;
};

/** Sole dish-video gate: Pro tier × capability × store switch. */
export async function resolveDishVideoAccess(
  restaurant: DishVideoGateRestaurant,
  capabilities: Capabilities | null,
): Promise<DishVideoAccess> {
  const settings = await loadPlatformProSettings();
  const pro = resolvePremiumGate(restaurant, 'menu_dish_video', settings).ok;
  return {
    pro,
    canManage: pro && capabilities != null && can(capabilities, 'dashboard.menu.video.manage'),
    guestVisible: pro && isRestaurantFeatureEnabled(restaurant.feature_flags, 'menu_dish_video_enabled'),
  };
}

export async function loadDishVideoGateRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<DishVideoGateRestaurant | null> {
  const { data } = await admin
    .from('restaurants')
    .select(DISH_VIDEO_GATE_RESTAURANT_COLUMNS)
    .eq('id', restaurantId)
    .maybeSingle();
  return (data as DishVideoGateRestaurant | null) ?? null;
}
