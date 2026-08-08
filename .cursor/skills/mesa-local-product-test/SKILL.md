---
name: mesa-local-product-test
description: >-
  Local product verification for Mesa: mesa-local-uat API first, Chrome DevTools MCP for UI,
  shared test account, cleanup writes; no checklist skip unless truly blocked.
  Use when user says 开始测试, 联调, 手工验收, 回归测试, 本地回归,
  or asks to verify product behavior on localhost (not only lint/unit).
---

# Mesa: local product testing

**Delivery gate:** For functional product changes, this skill is mandatory before commit/merge/done — see `.cursor/rules/uat-before-delivery.mdc`. Do not deliver on lint/unit alone.

## Environment

- **Host (default):** `http://localhost:3000` — if busy, **do not kill** the occupant; start/use another free port and set `MESA_UAT_BASE` (see always-on `.cursor/rules/dev-port-isolation.mdc`)
  - `npm run dev` → local Docker Supabase (Studio `:54323`, MCP `http://127.0.0.1:54321/mcp`); script picks a free web port when `:3000` is taken
  - `npm run cloud` → cloud project (use existing `user-supabase` / cloud MCP, read-only)
- **UI login (canonical — always use this for browser UAT):** `{MESA_UAT_BASE or http://localhost:3000}/auth/login`
  - One page for owner email **or** staff `login_name`; API `POST /api/auth/login` resolves kind and redirect
  - Do **not** open `/login`, `/auth/staff/login`, or `/{slug}/staff/login` for routine UAT (legacy/alias only)
- **Staff (default UAT):** `qiantai1` / `123456` — frontdesk on 白云 `restaurant-mohnrib5`
- **Owner (setup / buffet / menu):** `baiyun@gmail.com` / `123456` — owner of 白云 `restaurant-mohnrib5`
- **Forbidden account:** `qiantai@mesa.in` — do not use for local product testing
- **Allowed:** authenticated product APIs and UI for the test restaurant

Use **owner** when the staff restaurant lacks buffet/menu seed needed for open-table / order flows; then switch back to **qiantai1** for floor UAT when possible.

### MCP / DB binding

| App start | DB asserts |
|-----------|------------|
| `npm run dev` | MCP **`supabase-local`** / **`user-supabase-local`** → `http://127.0.0.1:54321/mcp` (SQL / tables). Do **not** query cloud MCP for local data. |
| `npm run cloud` / `stage` | Cloud/staging Supabase MCP (`user-supabase`), keep **read-only** for asserts. Mutations via product APIs only. |

Repo `.cursor/mcp.json` registers `supabase-local`. Ensure local `supabase start` before using it.

## Method

Default stack (do not substitute “lint only” or raw curl when this skill applies):

1. **API first — `scripts/mesa-local-uat.mjs`** (preferred over raw curl):
   - `node scripts/mesa-local-uat.mjs stack-health`
   - `node scripts/mesa-local-uat.mjs login --role staff` (or `owner`)
   - `node scripts/mesa-local-uat.mjs req GET|POST /api/... --jar staff --body '...'`
   - Assert `status` + stable `error` codes; optional `wait-json` after mutations
   - DB side-effects: **supabase-local** (dev) or cloud read-only SQL — never `db reset` unless user approved
2. **UI second — Chrome DevTools MCP** (`user-chrome-devtools`). Navigate/snapshot/click; verify disabled controls, lists, toasts. **Chrome/top-bar placement:** screenshot and check neighbor alignment against the approved end-state (same row / vertical mid) — not only that the label exists or a urgency class matches. No Playwright unless user asks.
3. **Cleanup** — reverse writes via product APIs (`close-session`, void/cancel as appropriate).
4. **Print smoke (when print in scope):** `node scripts/mesa-print-smoke.mjs` then full e2e only if agent/`npm run print` is up.
5. **Report** — each checklist item: `pass` / `fail` (+ brief note). **`skip` only if truly blocked** — see `.cursor/rules/local-product-testing.mdc`.

### Realtime / dual-tab recipe (do not skip)

1. `login` + baseline `req GET` of the read model (board / session / bill). Confirm `stack-health` / `ready` first — Docker/DB down is not a Realtime product fail.
2. UI: two isolated contexts (e.g. chrome-devtools `new_page` + `isolatedContext`) on the same board **list** surface; leave the **passive** page selected/`visibilityState=visible`.
3. Mutate via `mesa-local-uat req` (preferred) or the **active** tab only. **Never** `select_page` / focus the passive tab between mutate and assert — that fires focus/visibility catch-up and falsely “proves” sync.
4. Passive tab (still selected): `wait_for` text/state change; if flaky, `evaluate_script` for channel/subscribed hints, then one-shot GET.
5. API gate: `wait-json GET <same read model> --jar … --path <field>` until post-mutation value appears (UAT wait only — not product polling).
6. Report **fail** if API updated but passive UI never reflects within timeout; do not skip as “realtime hard”.

Do not skip for convenience, dual-tab/realtime difficulty, or “unit already covers it”. Pure presentation may omit API-first but must still run a UI assertion (not skip). If localhost/login/MCP is down after a real attempt, `skip` that blocked surface with the blocker noted; still report lint/build/unit.

## Data policy

- May write via normal product APIs; must cleanup after.
- **Forbidden without explicit in-thread permission:** `supabase db reset` or any hard DB wipe / destroy local database. Also: migrations as a “fix fix”, raw SQL against live/cloud, ops suspend, unrelated restaurants, hard-delete of non-throwaway schema objects.

## Standing authorization (no per-step confirm)

For **localhost** product testing of the shared UAT restaurant (`restaurant-mohnrib5`), the user grants **standing blanket authorization**. Do **not** pause the chat to ask confirmation for each step — including when the parent turn is code change + regression.

**Pre-authorized** (use freely; cleanup throwaway writes afterward):

- Typing / filling documented UAT passwords (`qiantai1`, `baiyun@gmail.com`) into `http://localhost:3000/auth/login` or `/api/auth/login`
- **`user-chrome-devtools` and `cursor-ide-browser` MCP** on localhost: navigate, snapshot, screenshot, click, fill, type, scroll, evaluate, dual tabs
- **`mesa-local-uat` / `mesa-print-smoke` scripts** and **supabase-local** read-only SQL asserts on the UAT restaurant
- Product API mutations on the test restaurant: open/close table, buffet/menu seed create/update/delete, orders, checkout, board refresh checks

**No approval popups:** Repo `.cursor/permissions.json` allowlists browser + local UAT MCP/scripts. User should use **Run mode = Auto-review** in Cursor Settings. **Never** retry with `requestSmartModeApproval` — that shows the confirmation card the user opted out of. If still blocked, report Run mode / permissions.json instead of asking per click.

**Still ask first:** anything that wipes the database (`supabase db reset` / equivalent hard wipe).

Lint/build/unit remain in `AGENTS.md` / `push-verification.mdc`.

## Verification

- [ ] `stack-health` (or equivalent) known before UAT
- [ ] API assertions via `mesa-local-uat` (or skip only with documented blocker)
- [ ] UI checked via Chrome DevTools MCP when needed (or skip only with documented blocker)
- [ ] Realtime/dual-tab items used the recipe above when in scope
- [ ] Throwaway data cleaned up
- [ ] Checklist reported pass/fail; any skip cites an objective blocker
