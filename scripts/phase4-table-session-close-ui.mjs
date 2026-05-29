/**
 * Phase 4: verify close-table UI wiring (ConfirmModal, confirm_checkout_close, i18n, no kitchen block).
 * Usage: node scripts/phase4-table-session-close-ui.mjs
 */
import { readFileSync } from 'fs';

const ROOT = new URL('..', import.meta.url).pathname;

function read(rel) {
  return readFileSync(`${ROOT}/${rel}`, 'utf8');
}

function assertContains(name, text, pattern, pass) {
  const ok = pattern.test(text);
  pass.push({ check: name, pass: ok });
  return ok;
}

function assertNotContains(name, text, pattern, pass) {
  const ok = !pattern.test(text);
  pass.push({ check: name, pass: ok });
  return ok;
}

function main() {
  const pass = [];
  const waiter = read('src/components/waiter/WaiterTableDetail.tsx');
  const owner = read('src/components/dashboard/OrdersHistoryManager.tsx');
  const waiterMsg = read('src/components/waiter/waiter-messages.ts');
  const messages = read('src/lib/i18n/messages.ts');
  const uiLib = read('src/lib/close-table-session-ui.ts');

  assertContains('waiter ConfirmModal', waiter, /ConfirmModal/, pass);
  assertContains('waiter confirm_close body', waiter, /confirm_close/, pass);
  assertNotContains('waiter shouldPromptCheckoutCloseConfirm', waiter, /shouldPromptCheckoutCloseConfirm/, pass);
  assertNotContains('waiter kitchen canCloseTableCard block', waiter, /canCloseTableCard/, pass);

  assertContains('owner ConfirmModal', owner, /ConfirmModal/, pass);
  assertContains('owner confirm_close body', owner, /confirm_close/, pass);
  assertContains('owner opens modal before POST', owner, /setCheckoutCloseConfirmTableId\(tableId\)/, pass);
  assertNotContains('owner kitchen canClose block', owner, /card\.cooking > 0 \|\| card\.ready > 0/, pass);
  assertNotContains('owner force_reason (old phase3)', owner, /force_reason/, pass);

  for (const lang of ['zh', 'en', 'pt']) {
    assertContains(`waiter i18n ${lang} confirm title`, waiterMsg, new RegExp(`${lang}:[\\s\\S]*closeTableCheckoutConfirmTitle`), pass);
  }

  for (const key of ['closeTableConfirmTitle', 'closeTableConfirmMessage', 'closeTableConfirmButton', 'closeTableCancel']) {
    assertContains(`orderHistory i18n ${key} zh`, messages, new RegExp(`${key}:`), pass);
  }

  assertContains('ui lib interpretCloseTableSessionResponse', uiLib, /interpretCloseTableSessionResponse/, pass);
  assertNotContains('ui lib shouldPromptCheckoutCloseConfirm', uiLib, /shouldPromptCheckoutCloseConfirm/, pass);

  const summary = {
    phase: 4,
    date: new Date().toISOString(),
    phase4_scope: {
      changes: [
        '409 checkout_confirm_required → ConfirmModal (waiter + owner)',
        'confirm_checkout_close:true on modal confirm',
        'Waiter proactive modal when checkoutRequestedTableIds includes table',
        'Shared interpretCloseTableSessionResponse for response handling',
        'Removed kitchen-based close button disable',
      ],
      unchanged: [
        'Server guard rules (Phase 3)',
        'Operational cleanup',
        'Demo mode local Supabase close branch',
        'Success refresh/toast flow',
      ],
    },
    checks: pass,
    all_pass: pass.every((c) => c.pass),
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.all_pass ? 0 : 1);
}

main();
