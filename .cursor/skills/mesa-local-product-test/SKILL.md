---
name: mesa-local-product-test
description: >-
  Local product verification for Mesa: curl APIs first, Chrome DevTools MCP for UI,
  shared test account, cleanup writes. Use when user says 开始测试, 联调, 手工验收,
  or asks to verify product behavior on localhost (not only lint/unit).
---

# Mesa: local product testing

## Environment

- **Host:** `http://localhost:3000`
- **Server (required):** `npm run dev` (loads `.env.local.dev` → local Docker Supabase). Do **not** use `npm run cloud` / `npm run stage` for product testing
- **Account:** `qiantai` / password:`654321`
- **Forbidden account:** `qiantai@mesa.in` — do not use for local product testing
- **Allowed:** authenticated product APIs and UI for the test restaurant
- **Out of scope by default:** kitchen board / kitchen staff APIs (skip unless the user explicitly asks)

## Method

1. **API first — curl** (session cookies after login). Assert status, stable `error` codes, payload shape.
2. **UI second — Chrome DevTools MCP** (`user-chrome-devtools`). Navigate/snapshot/click; verify disabled controls, lists, toasts. No Playwright unless user asks.
3. **Cleanup** — reverse writes via normal product APIs.
4. **Report** — each checklist item: `pass` / `fail` / `skip` (+ brief note).

Skip API-first only for pure presentation; note why. If localhost/login fails, mark API/UI `skip` and still report lint/build/unit when applicable.

## Data policy

- May write via normal product APIs; must cleanup after.
- **Forbidden:** migrations, raw SQL, `supabase db reset`, hard-delete sessions/tables, ops suspend, unrelated restaurants.

Auto-review approval cards may appear — proceed when user authorized testing in chat.

Lint/build/unit remain in `AGENTS.md` / `push-verification.mdc`.

## Verification

- [ ] API assertions done (or skip reasoned)
- [ ] UI checked via Chrome DevTools MCP when needed (or skip reasoned)
- [ ] Throwaway data cleaned up
- [ ] Checklist reported with pass/fail/skip
