import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuNotePreset, MenuNotePresetGroup } from '@/lib/menu-note-presets';

export type MenuNotePresetQueryError = {
  error: string;
  status: number;
  message?: string;
};

/** Sole dictionary load for staff dashboard + customer catalog. */
export async function listMenuNotePresetDictionary(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<
  | { groups: MenuNotePresetGroup[]; presets: MenuNotePreset[] }
  | MenuNotePresetQueryError
> {
  const [{ data: groups, error: groupsError }, { data: presets, error: presetsError }] =
    await Promise.all([
      admin
        .from('menu_note_preset_groups')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      admin
        .from('menu_note_presets')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);
  if (groupsError) {
    return { error: 'note_preset_groups_query_failed', message: groupsError.message, status: 500 };
  }
  if (presetsError) {
    return { error: 'note_presets_query_failed', message: presetsError.message, status: 500 };
  }
  return {
    groups: (groups || []) as MenuNotePresetGroup[],
    presets: (presets || []) as MenuNotePreset[],
  };
}

/** Sole allowed-id set for dish note_preset_keys validation. */
export async function listRestaurantNotePresetIds(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<Set<string> | MenuNotePresetQueryError> {
  const { data, error } = await admin
    .from('menu_note_presets')
    .select('id')
    .eq('restaurant_id', restaurantId);
  if (error) {
    return { error: 'note_presets_query_failed', message: error.message, status: 500 };
  }
  return new Set((data || []).map((row) => String(row.id)));
}
