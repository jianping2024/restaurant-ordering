#!/usr/bin/env node
/**
 * Expected-error asserts for in-store takeaway (exit 0 on success).
 */
const { spawnSync } = require('child_process');

function req(args) {
  const r = spawnSync('node', ['scripts/mesa-local-uat.mjs', ...args], {
    encoding: 'utf8',
    env: process.env,
  });
  const text = `${r.stdout || ''}${r.stderr || ''}`;
  const start = text.lastIndexOf('{');
  if (start < 0) {
    console.error('no_json', text);
    process.exit(1);
  }
  // Find matching top-level object from last `{` that starts a status payload —
  // prefer the last complete JSON object containing "status" or "ok".
  const candidates = text.match(/\{[\s\S]*?\}(?=\s*$|\s*\{)/g) || [];
  let parsed = null;
  for (const chunk of candidates) {
    try {
      const j = JSON.parse(chunk);
      if (j && (typeof j.status === 'number' || typeof j.ok === 'boolean' || j.error)) {
        parsed = j;
      }
    } catch {
      /* continue */
    }
  }
  if (!parsed) {
    try {
      parsed = JSON.parse(text.slice(text.indexOf('{')));
    } catch (e) {
      console.error('parse_fail', e.message, text.slice(-200));
      process.exit(1);
    }
  }
  return parsed;
}

// Leave billing so append rejects packaging (not session_billing).
const ensure = req([
  'req',
  'POST',
  '/api/restaurants/restaurant-mohnrib5/checkout/ensure-entry',
  '--jar',
  'qiantai',
  '--body',
  JSON.stringify({ table_id: '16ec68aa-2eb2-46f2-844d-166ff35e48be' }),
]);
const billSplitId = ensure.json?.bill_split_id || ensure.bill_split_id;
if (!billSplitId) {
  console.error('ensure', ensure);
  process.exit(1);
}
req([
  'req',
  'POST',
  '/api/restaurants/restaurant-mohnrib5/checkout/resume-ordering',
  '--jar',
  'qiantai',
  '--body',
  JSON.stringify({
    bill_split_id: billSplitId,
    table_id: '16ec68aa-2eb2-46f2-844d-166ff35e48be',
  }),
]);

const pack = req([
  'req',
  'POST',
  '/api/restaurants/restaurant-mohnrib5/orders/append',
  '--jar',
  'qiantai',
  '--body',
  JSON.stringify({
    table_id: '16ec68aa-2eb2-46f2-844d-166ff35e48be',
    client_request_id: '33333333-3333-4333-8333-333333333341',
    items: [{ menu_item_id: '45b4ece0-c5c4-451d-85e0-ceb1528fce80', qty: 1 }],
  }),
]);
if (pack.error !== 'menu_item_is_packaging') {
  console.error('pack', pack);
  process.exit(1);
}

const feat = req([
  'req',
  'PATCH',
  '/api/restaurant/features',
  '--jar',
  'baiyun',
  '--body',
  JSON.stringify({ flags: { takeaway_ordering: false } }),
]);
if (feat.error !== 'takeaway_group_has_open_sessions') {
  console.error('feat', feat);
  process.exit(1);
}

const xfer = req([
  'req',
  'POST',
  '/api/restaurants/restaurant-mohnrib5/staff/waiter/tables/action',
  '--jar',
  'qiantai',
  '--body',
  JSON.stringify({
    action: 'transfer',
    from_table_id: '16ec68aa-2eb2-46f2-844d-166ff35e48be',
    to_table_id: 'c72b4f69-b8a8-42d1-bd94-be48c548102f',
  }),
]);
const msg = String((xfer.json && xfer.json.message) || xfer.error || '');
if (!msg.includes('ordering_channel_mismatch')) {
  console.error('xfer', xfer);
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    asserts: ['menu_item_is_packaging', 'takeaway_group_has_open_sessions', 'ordering_channel_mismatch'],
  }),
);
