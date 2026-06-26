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
  const waiter = read('apps/web/src/components/waiter/WaiterTableDetail.tsx');
  const owner = read('apps/web/src/components/dashboard/OrdersHistoryManager.tsx');
  const closeAction = read('apps/web/src/components/dashboard/CloseTableSessionAction.tsx');
  const messages = read('apps/web/src/lib/i18n/messages.ts');
  const uiLib = read('apps/web/src/lib/close-table-session-ui.ts');

  assertContains('waiter CloseTableSessionAction', waiter, /CloseTableSessionAction/, pass);
  assertContains('waiter isCheckoutPending prop', waiter, /isCheckoutPending=\{isCheckoutPending\}/, pass);
  assertNotContains('waiter shouldPromptCheckoutCloseConfirm', waiter, /shouldPromptCheckoutCloseConfirm/, pass);
  assertNotContains('waiter kitchen canCloseTableCard block', waiter, /canCloseTableCard/, pass);

  assertContains('owner CloseTableSessionAction', owner, /CloseTableSessionAction/, pass);
  assertContains('owner isCheckoutPending prop', owner, /isCheckoutPending=\{isTableCheckoutRequested/, pass);
  assertNotContains('owner kitchen canClose block', owner, /card\.cooking > 0 \|\| card\.ready > 0/, pass);
  assertNotContains('owner force_reason (old phase3)', owner, /force_reason/, pass);
  assertNotContains('owner legacy checkout close modal state', owner, /setCheckoutCloseConfirmTableId/, pass);

  assertContains('close action skips generic confirm when checkout pending', closeAction, /if \(isCheckoutPending\) \{[\s\S]*setUnpaidCloseReasonOpen\(true\)/, pass);
  assertContains('close action unpaid checkout message key', closeAction, /closeTableUnpaidReasonMessageCheckout/, pass);

  for (const key of ['closeTableConfirmTitle', 'closeTableConfirmMessage', 'closeTableUnpaidReasonMessageCheckout', 'closeTableConfirmButton', 'closeTableCancel']) {
    assertContains(`orderHistory i18n ${key}`, messages, new RegExp(`${key}:`), pass);
  }

  assertNotContains('legacy checkout-only confirm title in orderHistory zh', messages, /closeTableCheckoutConfirmTitle:/, pass);

  assertContains('ui lib interpretCloseTableSessionResponse', uiLib, /interpretCloseTableSessionResponse/, pass);
  assertNotContains('ui lib shouldPromptCheckoutCloseConfirm', uiLib, /shouldPromptCheckoutCloseConfirm/, pass);

  const summary = {
    phase: 4,
    date: new Date().toISOString(),
    phase4_scope: {
      changes: [
        'Checkout-pending close opens unpaid-close reason dialog directly',
        'confirm_close:true on reason dialog confirm',
        'Shared CloseTableSessionAction for waiter + owner',
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
