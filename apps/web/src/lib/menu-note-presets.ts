import type { Language } from '@/types';
import { clampAppendCartNote, mergeAppendCartNotes } from '@/types';
import { parseTableIdParam } from '@/lib/restaurant-tables';

/** DB row: restaurant note-preset group. */
export type MenuNotePresetGroup = {
  id: string;
  restaurant_id: string;
  name_en: string;
  name_pt: string;
  name_zh: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
};

/** DB row: restaurant note preset. */
export type MenuNotePreset = {
  id: string;
  restaurant_id: string;
  group_id: string;
  name_en: string;
  name_pt: string;
  name_zh: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
};

export type MenuNotePresetNameFields = {
  name_en: string;
  name_pt: string;
  name_zh: string;
};

/** Guest/cart catalog: active groups with their active presets (ordered). */
export type MenuNotePresetCatalogGroup = {
  id: string;
  name_en: string;
  name_pt: string;
  name_zh: string;
  presets: Array<{
    id: string;
    name_en: string;
    name_pt: string;
    name_zh: string;
  }>;
};

export type MenuNotePresetCatalog = {
  groups: MenuNotePresetCatalogGroup[];
};

/** Sole on-screen label for a note-preset / group name row. */
export function menuNotePresetLocalizedName(
  row: MenuNotePresetNameFields,
  lang: Language,
): string {
  if (lang === 'zh') {
    const zh = row.name_zh.trim();
    if (zh) return zh;
  }
  if (lang === 'en') {
    const en = row.name_en.trim();
    if (en) return en;
  }
  const pt = row.name_pt.trim();
  if (pt) return pt;
  return row.name_en.trim() || row.name_zh.trim() || '';
}

export function parseMenuNotePresetNameFields(
  raw: Record<string, unknown>,
): MenuNotePresetNameFields | { error: string; status: number } {
  if (typeof raw.name_en !== 'string' || typeof raw.name_pt !== 'string') {
    return { error: 'invalid_note_preset_names', status: 400 };
  }
  const name_en = raw.name_en.trim();
  const name_pt = raw.name_pt.trim();
  const name_zh = typeof raw.name_zh === 'string' ? raw.name_zh.trim() : '';
  if (!name_en || !name_pt) {
    return { error: 'note_preset_en_pt_required', status: 400 };
  }
  return { name_en, name_pt, name_zh };
}

/** Validate dish note_preset_group_ids: unique group UUIDs in `allowedGroupIds`. */
export function normalizeMenuItemNotePresetGroupIds(
  raw: unknown,
  allowedGroupIds: ReadonlySet<string>,
): string[] | { error: string; status: number } {
  if (!Array.isArray(raw) || raw.some((key) => typeof key !== 'string')) {
    return { error: 'invalid_item_body', status: 400 };
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const id = parseTableIdParam(value);
    if (!id) {
      return { error: 'invalid_note_preset_group_ids', status: 400 };
    }
    if (!allowedGroupIds.has(id)) {
      return { error: 'invalid_note_preset_group_ids', status: 400 };
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Build guest catalog: active groups that still have ≥1 active preset. */
export function buildMenuNotePresetCatalog(
  groups: readonly MenuNotePresetGroup[],
  presets: readonly MenuNotePreset[],
): MenuNotePresetCatalog {
  const byGroup = new Map<string, MenuNotePreset[]>();
  for (const preset of presets) {
    if (!preset.active) continue;
    const list = byGroup.get(preset.group_id) || [];
    list.push(preset);
    byGroup.set(preset.group_id, list);
  }
  const orderedGroups = [...groups]
    .filter((g) => g.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at?.localeCompare(b.created_at || '') || 0);

  const catalogGroups: MenuNotePresetCatalogGroup[] = [];
  for (const group of orderedGroups) {
    const items = (byGroup.get(group.id) || []).sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at?.localeCompare(b.created_at || '') || 0,
    );
    if (items.length === 0) continue;
    catalogGroups.push({
      id: group.id,
      name_en: group.name_en,
      name_pt: group.name_pt,
      name_zh: group.name_zh,
      presets: items.map((p) => ({
        id: p.id,
        name_en: p.name_en,
        name_pt: p.name_pt,
        name_zh: p.name_zh,
      })),
    });
  }
  return { groups: catalogGroups };
}

/** Dish editor + dictionary manager: all groups (incl. inactive) with nested presets. */
export function buildMenuNotePresetEditorGroups(
  groups: readonly MenuNotePresetGroup[],
  presets: readonly MenuNotePreset[],
): Array<MenuNotePresetGroup & { presets: MenuNotePreset[] }> {
  const byGroup = new Map<string, MenuNotePreset[]>();
  for (const preset of presets) {
    const list = byGroup.get(preset.group_id) || [];
    list.push(preset);
    byGroup.set(preset.group_id, list);
  }
  return [...groups]
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at?.localeCompare(b.created_at || '') || 0)
    .map((group) => ({
      ...group,
      presets: (byGroup.get(group.id) || []).sort(
        (a, b) => a.sort_order - b.sort_order || a.created_at?.localeCompare(b.created_at || '') || 0,
      ),
    }));
}

/**
 * Sole guest chip toggle: at most one preset per catalog group.
 * Re-click same id clears; pick another id in the same group replaces.
 */
export function toggleCartNotePresetSelection(
  selectedIds: readonly string[],
  catalog: MenuNotePresetCatalog,
  presetId: string,
): string[] {
  const group = catalog.groups.find((g) => g.presets.some((p) => p.id === presetId));
  if (!group) return [...selectedIds];
  const siblingIds = new Set(group.presets.map((p) => p.id));
  const withoutSiblings = selectedIds.filter((id) => !siblingIds.has(id));
  if (selectedIds.includes(presetId)) return withoutSiblings;
  return [...withoutSiblings, presetId];
}

/** Sole wire note: selected chip labels (catalog order) + free text, joined with `; `. */
export function composeCartLineNote(params: {
  freeText: string;
  selectedNotePresetIds: readonly string[];
  catalog: MenuNotePresetCatalog;
  lang: Language;
}): string {
  const selected = new Set(params.selectedNotePresetIds);
  const labels: string[] = [];
  for (const group of params.catalog.groups) {
    for (const preset of group.presets) {
      if (!selected.has(preset.id)) continue;
      const label = menuNotePresetLocalizedName(preset, params.lang).trim();
      if (label) labels.push(label);
    }
  }
  let note = '';
  for (const label of labels) {
    note = mergeAppendCartNotes(note, label);
  }
  const free = clampAppendCartNote(params.freeText.trim());
  if (free) note = mergeAppendCartNotes(note, free);
  return note;
}

export function parseOrderedIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const id = parseTableIdParam(value);
    if (!id) return null;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.length > 0 ? ids : null;
}
