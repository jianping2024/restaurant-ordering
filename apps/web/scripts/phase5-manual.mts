/**
 * P5 manual integration: abnormal operations end-to-end (DB + service layer).
 * Usage (from repo root): cd apps/web && node --import tsx scripts/phase5-manual.mts [slug]
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { listAbnormalOperations } from '@/lib/abnormal-operations/owner-query';
import { patchAbnormalOperationWithAudit } from '@/lib/abnormal-operations/patch-abnormal-operation.service';
import { recordDiscountAppliedAuditIfNeeded } from '@/lib/checkout-discount/record-discount-audit';
import { patchOrderItemsWithVoidAudit } from '@/lib/order-item-void/patch-order-items.service';
import { closeTableSessionManual } from '@/lib/table-session/close-table-session.service';
import type { OrderItem } from '@/types';

type Check = { id: string; expect: string; pass: boolean; actual?: unknown };

function loadEnvFiles() {
  const root = new URL('../../../', import.meta.url).pathname;
  for (const name of ['.env.local.dev', '.env.local.supabase', '.env.local']) {
    try {
      const text = readFileSync(`${root}/${name}`, 'utf8');
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {
      /* optional */
    }
  }
}

async function createTestTable(admin: SupabaseClient, restaurantId: string, label: string) {
  const suffix = Date.now().toString(36).slice(-4);
  const displayName = `P5${label}${suffix}`.slice(0, 16);
  const tableId = randomUUID();
  const { error } = await admin.from('restaurant_tables').insert({
    id: tableId,
    restaurant_id: restaurantId,
    display_name: displayName,
    sort_order: 9999,
  });
  if (error) throw new Error(`create_table_failed:${error.message}`);
  return { tableId, displayName };
}

async function openSession(admin: SupabaseClient, restaurantId: string, tableId: string) {
  const sessionId = randomUUID();
  const { error } = await admin.from('table_sessions').insert({
    id: sessionId,
    restaurant_id: restaurantId,
    table_id: tableId,
    status: 'billing',
    opened_at: new Date().toISOString(),
  });
  if (error) throw new Error(`create_session_failed:${error.message}`);
  return sessionId;
}

async function insertOrder(
  admin: SupabaseClient,
  restaurantId: string,
  sessionId: string,
  tableId: string,
  displayName: string,
  itemStatus: OrderItem['item_status'] = 'pending',
) {
  const orderId = randomUUID();
  const now = new Date().toISOString();
  const items: OrderItem[] = [
    {
      name_pt: 'P5 dish',
      name: 'P5 dish',
      emoji: '🍲',
      qty: 1,
      price: 18,
      item_status: itemStatus,
    },
  ];
  const { error } = await admin.from('orders').insert({
    id: orderId,
    restaurant_id: restaurantId,
    session_id: sessionId,
    table_id: tableId,
    display_name: displayName,
    status: itemStatus === 'done' ? 'done' : 'pending',
    items,
    total_amount: 18,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`create_order_failed:${error.message}`);
  return { orderId, items, updatedAt: now };
}

async function insertBillSplit(
  admin: SupabaseClient,
  restaurantId: string,
  sessionId: string,
  tableId: string,
  displayName: string,
  total: number,
) {
  const splitId = randomUUID();
  const { error } = await admin.from('bill_splits').insert({
    id: splitId,
    restaurant_id: restaurantId,
    session_id: sessionId,
    table_id: tableId,
    display_name: displayName,
    order_ids: [],
    split_mode: 'even',
    persons: [{ name: 'Guest 1' }],
    result: [{ name: 'Guest 1', amount: total }],
    total_amount: total,
    status: 'requested',
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`create_split_failed:${error.message}`);
  return splitId;
}

async function countAbnormal(
  admin: SupabaseClient,
  restaurantId: string,
  type: string,
  sessionId?: string,
) {
  let q = admin
    .from('abnormal_operations')
    .select('id, source_action_id', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .eq('type', type);
  if (sessionId) q = q.eq('session_id', sessionId);
  const { data, count, error } = await q;
  return { count: count ?? data?.length ?? 0, rows: data ?? [], error: error?.message };
}

async function countOpLog(
  admin: SupabaseClient,
  restaurantId: string,
  actionType: string,
  entityId: string,
) {
  const { data, count, error } = await admin
    .from('operation_logs')
    .select('id', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .eq('action_type', actionType)
    .eq('entity_id', entityId);
  return { count: count ?? data?.length ?? 0, error: error?.message };
}

async function main() {
  loadEnvFiles();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('missing supabase env');
    process.exit(1);
  }

  const slug = process.argv[2] || 'restaurant-mo9y14xc';
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rest } = await admin
    .from('restaurants')
    .select('id, slug, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!rest?.id || !rest.owner_id) {
    console.error('restaurant_not_found', slug);
    process.exit(1);
  }

  const restaurantId = rest.id;
  const ownerId = rest.owner_id as string;
  const ownerActor = { userId: ownerId, displayName: 'P5 Owner', role: 'owner' as const };
  const waiterActor = { userId: ownerId, displayName: 'P5 Waiter', role: 'waiter' as const };
  const checks: Check[] = [];

  // Schema probe
  {
    const { error: abnErr } = await admin.from('abnormal_operations').select('id').limit(1);
    const { error: logErr } = await admin.from('operation_logs').select('id').limit(1);
    checks.push({
      id: 'schema_abnormal_operations',
      expect: 'table readable',
      pass: !abnErr,
      actual: abnErr?.message,
    });
    checks.push({
      id: 'schema_operation_logs',
      expect: 'table readable',
      pass: !logErr,
      actual: logErr?.message,
    });
  }

  // 1) UNPAID close → abnormal + operation_log
  let unpaidSessionId = '';
  {
    const { tableId, displayName } = await createTestTable(admin, restaurantId, 'un');
    unpaidSessionId = await openSession(admin, restaurantId, tableId);
    await insertOrder(admin, restaurantId, unpaidSessionId, tableId, displayName);

    const close = await closeTableSessionManual({
      admin,
      restaurantId,
      userId: ownerId,
      actor: ownerActor,
      closedReason: 'owner_closed',
      tableId,
      confirmClose: true,
      unpaidReason: 'left_unpaid',
    });

    const abn = await countAbnormal(admin, restaurantId, 'UNPAID_TABLE_CLOSED', unpaidSessionId);
    const log = await countOpLog(admin, restaurantId, 'UNPAID_TABLE_CLOSED', unpaidSessionId);
    const linked =
      abn.rows.length > 0 &&
      abn.rows.some((r) => r.source_action_id && typeof r.source_action_id === 'string');

    checks.push({
      id: '1_unpaid_close_rpc',
      expect: 'close ok',
      pass: close.ok === true,
      actual: close,
    });
    checks.push({
      id: '1_unpaid_abnormal_row',
      expect: '1 abnormal_operations UNPAID_TABLE_CLOSED',
      pass: abn.count >= 1,
      actual: abn,
    });
    checks.push({
      id: '1_unpaid_operation_log',
      expect: '1 operation_logs UNPAID_TABLE_CLOSED',
      pass: log.count >= 1,
      actual: log,
    });
    checks.push({
      id: '1_unpaid_source_action_link',
      expect: 'abnormal.source_action_id set',
      pass: linked,
      actual: abn.rows,
    });
  }

  // 2) Void item → abnormal + operation_log
  let voidOrderId = '';
  {
    const { tableId, displayName } = await createTestTable(admin, restaurantId, 'vd');
    const sessionId = await openSession(admin, restaurantId, tableId);
    const { orderId, items, updatedAt } = await insertOrder(
      admin,
      restaurantId,
      sessionId,
      tableId,
      displayName,
      'pending',
    );
    voidOrderId = orderId;
    const nextItems = items.map((item) => ({
      ...item,
      item_status: 'voided' as const,
      voided_at: new Date().toISOString(),
    }));

    const patch = await patchOrderItemsWithVoidAudit({
      admin,
      restaurantId,
      actor: waiterActor,
      orderId,
      existing: {
        items,
        updated_at: updatedAt,
        session_id: sessionId,
        table_id: tableId,
        display_name: displayName,
        status: 'pending',
      },
      nextItems,
      voidReason: 'staff_mistake',
    });

    const abn = await countAbnormal(admin, restaurantId, 'ITEM_DELETED');
    const log = await countOpLog(admin, restaurantId, 'ITEM_DELETED', orderId);

    checks.push({
      id: '2_void_patch',
      expect: 'patch ok',
      pass: patch.ok === true,
      actual: patch,
    });
    checks.push({
      id: '2_void_abnormal_row',
      expect: 'ITEM_DELETED abnormal row',
      pass: abn.count >= 1,
      actual: abn,
    });
    checks.push({
      id: '2_void_operation_log',
      expect: 'ITEM_DELETED operation_log',
      pass: log.count >= 1,
      actual: log,
    });
  }

  // 3) Discount → abnormal + operation_log
  let discountSplitId = '';
  {
    const { tableId, displayName } = await createTestTable(admin, restaurantId, 'dc');
    const sessionId = await openSession(admin, restaurantId, tableId);
    discountSplitId = await insertBillSplit(
      admin,
      restaurantId,
      sessionId,
      tableId,
      displayName,
      40,
    );

    await recordDiscountAppliedAuditIfNeeded({
      admin,
      restaurantId,
      actor: ownerActor,
      billSplit: {
        id: discountSplitId,
        session_id: sessionId,
        table_id: tableId,
        display_name: displayName,
        total_amount: 40,
      },
      discountRate: 15,
      reason: 'vip_guest',
    });

    const abn = await countAbnormal(admin, restaurantId, 'DISCOUNT_APPLIED');
    const log = await countOpLog(admin, restaurantId, 'DISCOUNT_APPLIED', discountSplitId);

    checks.push({
      id: '3_discount_abnormal_row',
      expect: 'DISCOUNT_APPLIED abnormal row',
      pass: abn.count >= 1,
      actual: abn,
    });
    checks.push({
      id: '3_discount_operation_log',
      expect: 'DISCOUNT_APPLIED operation_log',
      pass: log.count >= 1,
      actual: log,
    });

    // Dedup: second call should not duplicate
    await recordDiscountAppliedAuditIfNeeded({
      admin,
      restaurantId,
      actor: ownerActor,
      billSplit: {
        id: discountSplitId,
        session_id: sessionId,
        table_id: tableId,
        display_name: displayName,
        total_amount: 40,
      },
      discountRate: 15,
      reason: 'vip_guest',
    });
    const log2 = await countOpLog(admin, restaurantId, 'DISCOUNT_APPLIED', discountSplitId);
    checks.push({
      id: '3_discount_dedup',
      expect: 'still 1 operation_log for bill_split',
      pass: log2.count === 1,
      actual: log2,
    });
  }

  // 4) List + stats + filters
  {
    const list = await listAbnormalOperations(admin, { restaurantId });
    checks.push({
      id: '4_list_ok',
      expect: 'list returns ok with stats',
      pass: list.ok === true && (list.result?.stats.total_count ?? 0) >= 3,
      actual: list.ok ? { total: list.result?.total, stats: list.result?.stats } : list,
    });

    const filtered = await listAbnormalOperations(admin, {
      restaurantId,
      type: 'ITEM_DELETED',
      status: 'PENDING',
    });
    checks.push({
      id: '4_filter_type_status',
      expect: 'ITEM_DELETED PENDING filter returns rows',
      pass: filtered.ok === true && (filtered.result?.items.length ?? 0) >= 1,
      actual: filtered.ok ? filtered.result?.items.length : filtered,
    });
  }

  // 5) PATCH confirm / ignore / note + owner audit logs
  {
    const { data: pendingRows } = await admin
      .from('abnormal_operations')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'PENDING')
      .limit(2);

    const confirmId = pendingRows?.[0]?.id as string | undefined;
    const ignoreId = pendingRows?.[1]?.id as string | undefined;

    if (confirmId) {
      const confirm = await patchAbnormalOperationWithAudit({
        admin,
        restaurantId,
        ownerId,
        actor: ownerActor,
        id: confirmId,
        status: 'CONFIRMED',
        ownerNote: 'P5 confirm note',
      });
      const log = await countOpLog(admin, restaurantId, 'ABNORMAL_CONFIRMED', confirmId);
      checks.push({
        id: '5_patch_confirm',
        expect: 'CONFIRMED + ABNORMAL_CONFIRMED log',
        pass: confirm.ok && confirm.row.status === 'CONFIRMED' && log.count >= 1,
        actual: { confirm, log },
      });
    } else {
      checks.push({
        id: '5_patch_confirm',
        expect: 'CONFIRMED',
        pass: false,
        actual: 'no pending row',
      });
    }

    if (ignoreId) {
      const ignore = await patchAbnormalOperationWithAudit({
        admin,
        restaurantId,
        ownerId,
        actor: ownerActor,
        id: ignoreId,
        status: 'IGNORED',
      });
      const log = await countOpLog(admin, restaurantId, 'ABNORMAL_IGNORED', ignoreId);
      checks.push({
        id: '5_patch_ignore',
        expect: 'IGNORED + ABNORMAL_IGNORED log',
        pass: ignore.ok && ignore.row.status === 'IGNORED' && log.count >= 1,
        actual: { ignore, log },
      });
    } else {
      checks.push({
        id: '5_patch_ignore',
        expect: 'IGNORED',
        pass: false,
        actual: 'no second pending row',
      });
    }

    if (confirmId) {
      const noteOnly = await patchAbnormalOperationWithAudit({
        admin,
        restaurantId,
        ownerId,
        actor: ownerActor,
        id: confirmId,
        ownerNote: 'P5 updated note only',
      });
      const logs = await admin
        .from('operation_logs')
        .select('action_type')
        .eq('restaurant_id', restaurantId)
        .eq('entity_id', confirmId)
        .eq('action_type', 'ABNORMAL_NOTE_ADDED');
      checks.push({
        id: '5_patch_note_only',
        expect: 'note update + ABNORMAL_NOTE_ADDED log',
        pass:
          noteOnly.ok &&
          noteOnly.row.owner_note === 'P5 updated note only' &&
          (logs.data?.length ?? 0) >= 1,
        actual: { noteOnly, noteLogs: logs.data?.length },
      });
    }
  }

  // 6) Invalid status transition
  {
    const { data: confirmed } = await admin
      .from('abnormal_operations')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'CONFIRMED')
      .limit(1)
      .maybeSingle();

    if (confirmed?.id) {
      const bad = await patchAbnormalOperationWithAudit({
        admin,
        restaurantId,
        ownerId,
        actor: ownerActor,
        id: confirmed.id as string,
        status: 'PENDING',
      });
      checks.push({
        id: '6_invalid_transition',
        expect: 'reject PENDING from CONFIRMED',
        pass: !bad.ok && bad.code === 'invalid_status',
        actual: bad,
      });
    }
  }

  const summary = {
    phase: 5,
    slug,
    restaurant_id: restaurantId,
    env_url: url.replace(/https:\/\/([^.]+).*/, 'https://$1...'),
    date: new Date().toISOString(),
    manual_scope: [
      'UNPAID close → abnormal_operations + operation_logs',
      'Void item → ITEM_DELETED audit pair',
      'Discount → DISCOUNT_APPLIED audit pair + dedup',
      'Owner list/stats/filters',
      'PATCH confirm/ignore/note → owner operation_logs',
      'Invalid status transition rejected',
    ],
    checks,
    all_pass: checks.every((c) => c.pass),
    refs: { unpaidSessionId, voidOrderId, discountSplitId },
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.all_pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
