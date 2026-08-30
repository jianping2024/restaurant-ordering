#!/usr/bin/env node
/**
 * Fiscal signing cloud path UAT (local Supabase + web :3000).
 * register → activate → provision → revoke → assert re-activate needs new register.
 *
 *   node --import tsx scripts/fiscal-signing-uat.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activateFiscalSigning,
  getFiscalSigningRestaurantStatus,
  pullFiscalSigningProvision,
  registerFiscalSigningDevice,
  revokeFiscalSigning,
  signPrintAgentJwt,
} from '@mesa/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = (process.env.MESA_UAT_BASE || 'http://localhost:3000').replace(/\/$/, '');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';

function loadEnvFile(p) {
  try {
    const raw = readFileSync(p, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(join(ROOT, '.env.local.dev'));
loadEnvFile(join(ROOT, 'apps/web/.env.local'));

const records = [];
function record(name, ok, note = '') {
  records.push({ name, ok, note });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? ' — ' + note : ''}`);
}

async function main() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    record('env-service-role', false, 'SUPABASE_SERVICE_ROLE_KEY missing');
    process.exit(1);
  }
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rest, error: rErr } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('slug', 'restaurant-mohnrib5')
    .maybeSingle();
  if (rErr || !rest) {
    record('load-restaurant', false, rErr?.message || 'not found');
    process.exit(1);
  }
  record('load-restaurant', true, rest.id);

  const deviceId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  await admin.from('fiscal_signing_installations').delete().eq('restaurant_id', rest.id).eq('device_id', deviceId);

  const validUntil = new Date(Date.now() + 86400000 * 30).toISOString();
  await admin.from('print_agent_devices').upsert(
    {
      id: deviceId,
      restaurant_id: rest.id,
      label: 'fiscal-signing-uat',
      paired_at: new Date().toISOString(),
      valid_until: validUntil,
      revoked_at: null,
    },
    { onConflict: 'id' },
  );
  record('upsert-device', true, deviceId);

  const pemPath = join(
    ROOT,
    '../farvoo-fatura/apps/fiscal-agent/internal/fiscal/testdata/dev_signing_key.pem',
  );
  let productPem;
  try {
    productPem = readFileSync(pemPath, 'utf8');
  } catch (e) {
    record('load-product-pem', false, String(e));
    process.exit(1);
  }
  process.env.FISCAL_PRODUCT_PRIVATE_KEY_PEM = productPem;
  record('load-product-pem', true);

  const reg = await registerFiscalSigningDevice(admin, {
    restaurantId: rest.id,
    deviceId,
    devicePublicKey: publicKey,
  });
  record('register-device', reg.ok, reg.ok ? reg.installation.status : reg.error);
  if (!reg.ok) process.exit(1);

  const st1 = await getFiscalSigningRestaurantStatus(admin, rest.id);
  record('status-registered', st1.status === 'registered', st1.status);

  const act = await activateFiscalSigning(admin, {
    restaurantId: rest.id,
    actorUserId: '00000000-0000-4000-8000-000000000099',
  });
  record('ops-activate', act.ok, act.ok ? act.installation.status : `${act.error} ${act.detail || ''}`);
  if (!act.ok) process.exit(1);

  const pull = await pullFiscalSigningProvision(admin, {
    restaurantId: rest.id,
    deviceId,
  });
  record('agent-pull-provision', pull.ok, pull.ok ? `v${pull.signingKeyVersion}` : pull.error);
  if (!pull.ok) process.exit(1);

  const jwtSecret = process.env.PRINT_AGENT_JWT_SECRET;
  if (jwtSecret && jwtSecret.length >= 16) {
    const jwt = signPrintAgentJwt(
      { restaurant_id: rest.id, device_id: deviceId },
      jwtSecret,
      3600,
    );
    const httpReg = await fetch(`${BASE}/api/print-agent/fiscal-signing/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_public_key: publicKey }),
    });
    const httpRegBody = await httpReg.json().catch(() => ({}));
    record(
      'http-register',
      httpReg.ok || httpReg.status === 409,
      `${httpReg.status} ${httpRegBody.error || httpRegBody.status || ''}`,
    );

    const httpPull = await fetch(`${BASE}/api/print-agent/fiscal-signing/provision`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const httpPullBody = await httpPull.json().catch(() => ({}));
    record(
      'http-provision',
      httpPull.ok && Boolean(httpPullBody.wrapped_private_key),
      `${httpPull.status}`,
    );
  } else {
    record('http-register', false, 'PRINT_AGENT_JWT_SECRET missing');
    record('http-provision', false, 'PRINT_AGENT_JWT_SECRET missing');
  }

  const rev = await revokeFiscalSigning(admin, {
    restaurantId: rest.id,
    actorUserId: '00000000-0000-4000-8000-000000000099',
  });
  record('ops-revoke', rev.ok, rev.ok ? rev.installationId : rev.error);

  const { data: revokedRow } = await admin
    .from('fiscal_signing_installations')
    .select('status, wrapped_private_key')
    .eq('id', act.installation.id)
    .maybeSingle();
  record(
    'revoke-terminal',
    revokedRow?.status === 'revoked' && revokedRow.wrapped_private_key == null,
    revokedRow?.status,
  );

  const actAgain = await activateFiscalSigning(admin, {
    restaurantId: rest.id,
    actorUserId: '00000000-0000-4000-8000-000000000099',
  });
  record(
    'activate-after-revoke-needs-register',
    !actAgain.ok && actAgain.error === 'device_not_registered',
    actAgain.error || 'unexpected ok',
  );

  await admin.from('fiscal_signing_installations').delete().eq('device_id', deviceId);
  await admin.from('print_agent_devices').delete().eq('id', deviceId);
  record('cleanup', true);

  const failed = records.filter((r) => !r.ok);
  console.log('\n=== FISCAL SIGNING UAT SUMMARY ===');
  for (const r of records) console.log(`${r.ok ? 'pass' : 'fail'}\t${r.name}\t${r.note}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
