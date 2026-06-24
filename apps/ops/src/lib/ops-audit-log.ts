import type { SupabaseClient } from '@supabase/supabase-js';
import { platformAuditActionLabel } from '@/lib/platform-audit';
import { fetchUserEmailsMap } from '@/lib/ops-user-lookup';

export const AUDIT_LOG_COLUMNS =
  'id, actor_user_id, action, target_type, target_id, restaurant_id, metadata, created_at';

export type AuditLogDbRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  restaurant_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AuditLogApiItem = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  restaurantId: string | null;
  restaurantName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorEmail: string | null;
};

export async function fetchRestaurantNamesMap(
  admin: SupabaseClient,
  restaurantIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (restaurantIds.length === 0) return names;

  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name')
    .in('id', restaurantIds);

  for (const row of restaurants || []) {
    names.set(row.id, row.name);
  }
  return names;
}

async function fetchAuditEnrichmentMaps(admin: SupabaseClient, rows: AuditLogDbRow[]) {
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter(Boolean)),
  ) as string[];
  const restaurantIds = Array.from(
    new Set(rows.map((r) => r.restaurant_id).filter(Boolean)),
  ) as string[];

  const [actorEmails, restaurantNames] = await Promise.all([
    fetchUserEmailsMap(admin, actorIds),
    fetchRestaurantNamesMap(admin, restaurantIds),
  ]);

  return { actorEmails, restaurantNames };
}

export async function enrichAuditLogRows(
  admin: SupabaseClient,
  rows: AuditLogDbRow[],
): Promise<AuditLogApiItem[]> {
  const { actorEmails, restaurantNames } = await fetchAuditEnrichmentMaps(admin, rows);

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    restaurantId: r.restaurant_id,
    restaurantName: r.restaurant_id ? restaurantNames.get(r.restaurant_id) ?? null : null,
    metadata: r.metadata,
    createdAt: r.created_at,
    actorEmail: r.actor_user_id ? actorEmails.get(r.actor_user_id) ?? null : null,
  }));
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function auditLogRowsToCsv(
  rows: AuditLogDbRow[],
  actorEmails: Map<string, string | null>,
  restaurantNames: Map<string, string>,
): string {
  const header = ['时间', '操作人', '操作', '目标类型', '目标ID', '餐厅', '餐厅ID', '元数据'];
  const lines = [header.join(',')];

  for (const row of rows) {
    const restaurantName = row.restaurant_id ? restaurantNames.get(row.restaurant_id) ?? '' : '';
    lines.push(
      [
        csvCell(new Date(row.created_at).toISOString()),
        csvCell(row.actor_user_id ? actorEmails.get(row.actor_user_id) ?? '' : ''),
        csvCell(platformAuditActionLabel(row.action)),
        csvCell(row.target_type),
        csvCell(row.target_id),
        csvCell(restaurantName),
        csvCell(row.restaurant_id ?? ''),
        csvCell(JSON.stringify(row.metadata ?? {})),
      ].join(','),
    );
  }

  return lines.join('\n');
}

export async function enrichAuditLogRowsForCsv(
  admin: SupabaseClient,
  rows: AuditLogDbRow[],
): Promise<string> {
  const { actorEmails, restaurantNames } = await fetchAuditEnrichmentMaps(admin, rows);
  return auditLogRowsToCsv(rows, actorEmails, restaurantNames);
}
