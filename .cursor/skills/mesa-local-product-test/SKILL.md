---
name: mesa-local-product-test
description: >-
  Local product verification for Mesa: curl APIs first, Chrome DevTools MCP for UI,
  shared test account, cleanup writes; no checklist skip unless truly blocked.
  Use when user says 开始测试, 联调, 手工验收, 回归测试, or asks to verify product
  behavior on localhost (not only lint/unit).
---

# Mesa: local product testing

## Environment

- **Host:** `http://localhost:3000` (`npm run cloud` or `npm run dev`)
- **Staff (default UAT):** `qiantai1` / `123456` — frontdesk on 白云 `restaurant-mohnrib5`
- **Owner (setup / buffet / menu):** `baiyun@gmail.com` / `123456` — owner of 白云 `restaurant-mohnrib5`
- **Forbidden account:** `qiantai@mesa.in` — do not use for local product testing
- **Allowed:** authenticated product APIs and UI for the test restaurant

Use **owner** when the staff restaurant lacks buffet/menu seed needed for open-table / order flows; then switch back to **qiantai1** for floor UAT when possible.

## Method

1. **API first — curl** (session cookies after login). Assert status, stable `error` codes, payload shape.
2. **UI second — Chrome DevTools MCP** (`user-chrome-devtools`). Navigate/snapshot/click; verify disabled controls, lists, toasts. No Playwright unless user asks.
3. **Cleanup** — reverse writes via normal product APIs.
4. **Report** — each checklist item: `pass` / `fail` (+ brief note). **`skip` only if truly blocked** — see `.cursor/rules/local-product-testing.mdc` (No skip unless truly blocked).

Do not skip for convenience, dual-tab/realtime difficulty, or “unit already covers it”. Pure presentation may omit API-first but must still run a UI assertion (not skip). If localhost/login/MCP is down after a real attempt, `skip` that blocked surface with the blocker noted; still report lint/build/unit.

## Data policy

- May write via normal product APIs; must cleanup after.
- **Forbidden without explicit in-thread permission:** `supabase db reset` or any hard DB wipe / destroy local database. Also: migrations as a “fix fix”, raw SQL against live/cloud, ops suspend, unrelated restaurants, hard-delete of non-throwaway schema objects.

## Standing authorization (no per-step confirm)

For **localhost** product testing of the shared UAT restaurant (`restaurant-mohnrib5`), the user grants **standing blanket authorization**. Do **not** pause the chat to ask confirmation for each step.

**Pre-authorized** (use freely; cleanup throwaway writes afterward):

- Typing / filling documented UAT passwords (`qiantai1`, `baiyun@gmail.com`) into localhost login UI or `/api/auth/login`
- Browser DevTools: navigate, snapshot, click, fill, evaluate_script, dual tabs, network inspection
- Product API mutations on the test restaurant: open/close table, buffet/menu seed create/update/delete, orders, checkout, board refresh/ETag checks
- Immediate `requestSmartModeApproval: true` retry when Auto-review blocks a step that is in this list (use the exact block reason; do not ask the user first)

**Still ask first:** anything that wipes the database (`supabase db reset` / equivalent hard wipe).

Lint/build/unit remain in `AGENTS.md` / `push-verification.mdc`.

## Verification

- [ ] API assertions done (or skip only with documented blocker)
- [ ] UI checked via Chrome DevTools MCP when needed (or skip only with documented blocker)
- [ ] Throwaway data cleaned up
- [ ] Checklist reported pass/fail; any skip cites an objective blocker
