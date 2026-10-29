# AGENTS.md

Guidance for AI coding agents in this repository.

## Priority (conflicts)

1. Safety and data protection  
2. Tenant isolation and RLS  
3. User-requested scope  
4. Behavior-change structure — `.cursor/rules/analysis-before-code.mdc` + skill `mesa-analyze-before-code` + `.cursor/rules/best-practice-not-patches.mdc` (best-practice end-state only; never lead with补丁). Wins over “minimal patch” / “copy nearby layout” when those leave a second representation of the same step/label/mapping  
5. Token-saving (search limits, concise output)  
6. Style / formatting  

Do not broaden the task unless the user asks.

**This file:** stack, commands, repo map, domain invariants, DB how-to, which checks, safety.  
**Not this file:** analyze-first, end-state/reuse gates, branching, commit permission → `analysis-before-code.mdc` + `best-practice-not-patches.mdc` + `.cursor/skills/mesa-analyze-before-code/`. Doc nav → `project-rules.mdc`.

## Stack

- Next.js 14 App Router, React 18, TypeScript strict, Tailwind; Supabase (Auth/DB/RLS); Fiscal/print Agent in **farvoo-fatura**; Vercel; CI Node 20 + **npm** (`package-lock.json`; no yarn/pnpm/bun unless asked).
- Go only via Docker — do not ask the user to install Go locally.

## Commands

| Action | Command |
|--------|---------|
| Web (local Docker Supabase) | `npm run dev` → `0.0.0.0:3000` |
| Web (cloud) | `npm run cloud` |
| Web (stage) | `npm run stage` |
| Ops | `npm run dev:ops` → `:3001` |
| Lint | `npm run lint`（或 `-w @mesa/web` / `@mesa/ops`） |
| Typecheck | `npm run typecheck`（或 `typecheck:web` / `typecheck:ops`） |
| Build web / ops | `npm run build` / `npm run build:ops`（**push** 门禁，不是 commit） |
| Agent gates | `bash scripts/agent-gates/gate.sh scan\|uat\|check\|build\|status` |
| Migrations | `supabase db push` (after `supabase link`) |

Print / Fiscal Agent：源码与发布在 **farvoo-fatura**（`fiscal-agent-v*`），不在本仓。

## Layout

- `apps/web` — tenant product (`@/*` → `src/*`)
- `apps/ops` — platform ops
- `packages/shared` — `@mesa/shared`
- Print / Fiscal Agent — **farvoo-fatura** repo（本仓不再含 `apps/print-agent`）
- `supabase/migrations` — append only; do not edit applied history
- `docs/` — product/design/technical truth

## Coding invariants

- Prefer nearby **idiom/style**; do **not** copy a parallel data/copy shape when analysis requires one end-state representation. Do not add private mint helpers that only wrap/forward into a public twin — one function per capability. Runtime auth is `can`/`requirePermission` only — never add a parallel role/mode whitelist beside capability. Middleware session bypass lives only in `middleware-session-policy.ts` (matcher + early-return). Dashboard list **date-range** UI is two `@mesa/ui` `DatePicker`s (start + end); do not add a parallel `DayPicker mode="range"` / `DashboardDateRangePicker` for the same filter job. Dashboard filterable lists (operation logs, abnormal ops, dish history) fetch only via `useDashboardListQuery` (one query snapshot, abortable, keep previous rows while loading) — do not reintroduce parallel `debouncedFilters` + `page` dual-trigger `load` effects.
- **No API polling except named realtime fallback** — see `.cursor/rules/no-polling-except-fallback.mdc` (lifecycle one-shots OK; interval fetch of read models forbidden).
- Scope to requested behavior; `@/*` imports; no service keys on the client; restaurant-scoped queries/APIs.
- UI: `src/components/ui` + brand tokens.
- Tables: `table_id` = UUID; `display_name` = label; print payloads need both; no legacy `table_number`; receipts never show table UUIDs.
- **On-screen dish name:** sole picker `resolveMenuItemLocalizedName` (UI lang + snapshot trilingual); print stays `menuLocalizedName` + `print_locale`. Do not add `item.name || item.name_pt` beside it.
- **Guest catalog card layout:** sole `MenuItemCard` + `menu-item-card-layout` (`MENU_ITEM_CARD_SHELL_CLASS` = `mesa-menu-item-card`; pad/radius/thumb via CSS `--mesa-menu-card-thumb` — narrow **88** / ≥40rem host **112**, matching p-3/rounded-xl → p-4/rounded-2xl; no shell `overflow-hidden`; body sole `MENU_ITEM_CARD_BODY_CLASS` = **min-h** thumb (never fixed `h` lock — grows when name+flavor+foot exceed thumb so + stays inside pad); list cols sole `CUSTOMER_MENU_ITEM_LIST_HOST_CLASS` + `CUSTOMER_MENU_ITEM_LIST_CLASS` via container 1/≥40rem:2/≥62rem:3 — not viewport `xl:`; name≤2 / flavor≤1 when hints on incl. empty reserve / foot sole `MENU_ITEM_CARD_PRICE_CLASS` (truncate) + `MENU_ITEM_CARD_ACTION_SLOT_CLASS` (shrink-0); list qty sole one 36px gold circle `MENU_ITEM_CARD_GOLD_ACTION_CLASS` (`+` at 0, qty number after) → tap opens `MENU_ITEM_CARD_QTY_PILL_CLASS` −/n/+ over the whole price row (gold + stays put; idle/outside/0 collapses) so price is visible at rest — never `CartQtyStepper` on the list card; **no list description**); gold text `MenuItemFlavorChips` only — never a parallel card chrome, never list desc slot, never fixed empty 6.75rem action column for bare `+`.
- **Recommended dishes:** sole list `menu_recommended_items` + catalog `recommendedItemIds`; customer merchandising is one `CustomerRecommendedRail` via sole `CustomerMenuCategoryNav` `catalogLeading` (order: recommended → sticky sub chips → dish list; locked 4:3 well + one-line truncated `recommendedName` + tight `recommendedPrice`; tap opens detail; band `min-w-0 overflow-hidden`, no `-mx` bleed). Do not overlay the list gold action (`MenuItemCardAction`), reuse `MenuItemCard`, add `is_recommended` on `menu_items`, or a real/virtual `recommended` category. Dashboard add is one `POST` `{ menu_item_ids }` (array even for one dish); do not keep a parallel `menu_item_id` add body.
- **Dish history list:** sole page is Lisbon today (`created_at`/`added_at`) + `{ items, page, pageSize, total }` + `ListPaginationBar` (10/20; first/prev/next/last icon buttons, aria-label only); `session_open` from restaurant `open`/`billing` sessions. Do not `.in('id', sessionIds)`, cursor/`loadMore`, or a parallel 20/50/100 page-size set.
- **Guest by-item called-checkout page:** sole screen `BillCheckoutSubmittedScreen` (by_item only; whole_table/even keep total + split rows). Order: `guestCalledTicket` dish list of my unpaid ticket (euros from `guestClaimLineAmounts`, never unit×qty; hidden when mine is settled) → total = whole table via `buildCustomerTableSettlementSummary` (collected + called + unclaimed = table; zero called/unclaimed rows hidden) → split rows sole order `orderCustomerTableSplitRows` (mine unpaid → other unpaid → settled; newest `called_at` first per band) → feedback block (never merged with the dish list). Do not filter split rows to mine only, label my ticket amount as the total, or add a parallel dish-amount/sort/summary helper; time is `bill_split_ticket_calls.called_at` via `IndividualTicketInfo.called_at`; Closed table: the last collect closes the table in the same write, so the live read never has it — the page reads the closed session's final split/ledger/tickets once via `closed_session_id` (`loadCustomerBillContext` `closedSessionId`, `loadCustomerExistingSplit({includePaid})`; only this table's closed session, else empty) and recomputes; title `checkoutSettledHint` only when every ticket is settled, else `checkoutClosedUnpaidHint`. Never freeze the pre-close snapshot as the final truth, never mark everyone paid because the table closed. See `docs/guest-individual-checkout.zh.md` §15.
- **Menu dish time slot:** sole column `menu_items.time_slot_id` (null = all day; composite FK to `buffet_time_slots`, slot delete → all day); sole rule `resolveMenuTimeSlotId` (nearest slot to the moment, Lisbon + weekday, same ladder as `resolve_buffet_prices` — never cut a dish at the slot's `end_time`) fixed per table by session `opened_at` via `resolveSessionMenuTimeSlotId` (no session → now); guest view filter sole `resolveCustomerMenuCatalogView({ menuTimeSlotId, orderingChannel })` (hides recommended + categories with no dishes left after channel/slot filters); write gate sole `menuItemsServedInSession` in `resolveAppendCartItems` + round lines (`menu_item_off_time_slot`). Dish form = single-select chips 全天 + slots. Do not add a per-session slot column, a grace-minutes setting, or a second filter beside the catalog view.
- **Staff catalog list thumb:** sole `MenuItemListThumb` (40×40 photo else emoji); do not inline a second 40×40 `Image` in MenuManager / recommended picker. Guest cards stay `MenuItemCard`.
- **Menu dish list row:** sole on-screen title `formatMenuCatalogItemLabel`; identity (name+meta) separate from actions. Mobile stacks name → meta → one compact action cluster (`€` + thin toggle + text edit/delete, `gap-3` + extra `mr-1.5` after toggle so switch≠edit cramped, no `justify-between` desert). Desktop keeps identity left and the same cluster right-aligned. Do not put price/toggle/actions on the same band as the dish name; do not keep a `⋯` overflow menu or PT·EN·ZH one-line truncate for the list title.
- **Menu category same-parent sort:** sole `MenuCategorySortTree` + `reorderMenuCategories` / `menuCategorySiblingsInScope` + `SortOrderDragHandle` (`PATCH …/categories` `{ action:'reorder', parent_id, ordered_ids }`); never parallel `rc-tree` HTML5 drag for category order.
- **Dashboard today amount card:** sole UI is settled `text-brand-gold` + uncollected `text-brand-gold/40` with labels `todayRevenueCollected` / `todayRevenueUncollected` under the amounts (not one same-weight gold string); hide `+` and uncollected when amount is 0; uncollected per live session only via `liveSessionUncollectedAmount` (requested split → checkout `pending`, else billable − collected). Do not sum floor `sessionTotal` / raw `orders.total_amount` beside it.
- **Value-analytics dish ranking:** sole UI is month|quarter|year period pickers (from earliest restaurant daily stats through current, no future) + paginated qty ranking from `GET /api/analytics/menu-item-consumption` (`analytics_daily_menu_item_consumption` + today live); click rank toggles `sort=asc|desc` (absolute ranks kept). Do not reintroduce Top10/`topItems` or bind ranking to overview day/week grains.
- **Kitchen prep tray:** sole state `useKitchenPrepTrays` on `KitchenScreenBoard` (per-station `selected`/`skipped`, persistence, hygiene, in-flight keys, ready-rail open; panes are controlled); sole `KitchenPrepTray` mounted inside `KitchenStationPane`, or once per screen with station `sections` when `kitchen_screens.shared_prep_tray` (≥2 stations; `mesa-kitchen-board` ≥72rem one row of stations | tray 36%/30% with 4, else stacked); shared prep = `collectStationPrepBatches` posted one station at a time to the same prep API (never parallel, never a multi-station body) (both views share one `selected`; extra `skipped` = tray-only dashed chips; pure helpers `buildPrepTrayCards`/`toggleTrayChip`/`setTrayKeysSelected`/`removeTrayKeys`; card identity sole `prepTrayCardKey` = dish + trimmed note — different/blank notes must not stack); sole prep button lives in the tray footer (station footer = reprint only); big photo sole `MenuItemListThumb` size 160 (never shrink); split via container `mesa-kitchen-pane` (≥56rem 45|55, else stacked); local-only persistence `kitchen-prep-tray-storage`. Do not keep a second footer prep button or a parallel tray selection state.
- **Kitchen group header:** sole `KitchenGroupHeader` in `KitchenStationPane` for both by-table and by-dish (chevron · select · thumb only on the dish header · title + `summarizeKitchenGroup` summary · «已选 n/m»; sticky); sole table title `t.tableTitle`; sole hot-wait gate `isKitchenWaitHot`; «已选 n/m» / «N 桌» / «最久 N 分» copy is the one shared set `selectedOf`/`tableCount`/`longestWait` (header + prep tray; tray card tables = `selectedTableCount`, distinct tables, never chip count); dish thumb appears once per dish (by-dish header / by-table rows, never on by-dish L2 rows); workbench rows never show a status chip (all `pending`) — only the ready rail does. Do not reintroduce a `#` placeholder tile, `n/m` pill, `收起` text link, or `DishAggregate.totalQty`.
- **Kitchen ready-after minutes:** sole editor `FeatureFlagsManager` + `PATCH /api/restaurant/features` (`settings.features.manage`); do not keep `KitchenHubReadyAfterSetting` or `…/staff/kitchen/settings`.
- **Guest storefront band:** sole mount `CustomerMenuStorefrontScroll` + `CustomerStorefrontBand` via `customerStorefrontShouldShow`/`buildCustomerStorefrontBandModel` (`cover_url`/`logo_url`/`business_hours`/`storefront_intro` + address/phone/geo); empty cover uses placeholder sole `resolveStorefrontCoverUrl` → `/storefront/default-cover.jpg`; classic+sushi guest page only (not staff-assisted/embedded/bill); page scroll sole `scrollMode="page"` on `CustomerMenuCategoryNav`; hours sole `restaurant-business-hours` (Lisbon, never print `schedule`); intro sole `restaurant-storefront-intro`; image compress sole `compressStorefrontImageFile` + `POST /api/restaurant/storefront-image` (`setRestaurantStorefrontImage`); settings sole `RestaurantStorefrontSettingsSection` in `SettingsForm` + `PATCH …/settings` hours/intro. Do not reuse print-agent schedule as guest hours, or put the band inside the right pane only.
- **Customer chrome + submit feedback:** language+theme sole `AppearanceChromeGroup` capsule (`appearanceChromeGroupClass`, segments `appearanceChromeButtonClass('segment')`, SVG `appearance-icons`) — never two loose 44px ghost buttons with a gap; footer icons sole `FooterIconSlot` (44 box, badge `right-0 top-0` inside — never negative offset under the summary `overflow-hidden`); guest submit success sole `useCustomerMenuSubmitFeedback` → footer ✓ pill + bag pop (no success toast on the menu page); `ToastContainer` centered at `--mesa-toast-bottom` (lifted by `[data-mesa-bottom-dock]`).
- **Guest Realtime client:** sole browser client for QR-menu Realtime + reads is `createGuestClient` (`lib/supabase/guest-client.ts`, anon, no auth-cookie session); `CustomerTableSessionRealtime`, `use-table-order-round`, `use-individual-checkout-signals` use it — never `createClient` (staff cookie) on a guest surface, and do not widen anon-only `orders`/`table_sessions` RLS to `authenticated` to compensate.
- **Browser UUID:** sole mint `mintBrowserUuid` (randomUUID or getRandomValues v4); guest `client_id` and append `client_request_id` both call it. Do not add a `Date.now().toString(16)` fallback beside it.
- Go: Docker commands above; `gofmt`; focused table-driven tests for parser/routing.

## Database

- Schema: read `docs/ai-schema.md` first. Open migrations only for exact SQL/RLS/indexes/defaults. Update `ai-schema.md` when schema changes.
- **Local before push:** before `git push` that includes `supabase/migrations/**`, or before staging/cloud `supabase db push`, apply pending migrations on local Docker first (`db push --local --include-all` / `migration up --local --include-all`). Never leave local tip behind cloud/files — `.cursor/rules/local-db-before-push.mdc` + `docs/db-migration-runbook.zh.md`.

## Checks

**Shared gate (Claude Code · Codex · Cursor):** sole runner `bash scripts/agent-gates/gate.sh` — detail in [`scripts/agent-gates/README.md`](./scripts/agent-gates/README.md). Hooks: `.claude/settings.json` + `.codex/hooks.json` + **Cursor** `.cursor/hooks.json`（`mesa-gate-shell.sh` / `mesa-gate-browser.sh`）call the same script.

- **Commit gate (hard):** before any product `git commit`: scoped **lint + typecheck** must **pass** — `npm run lint -w @mesa/web|@mesa/ops` + `npm run typecheck -w @mesa/web|@mesa/ops` (or `gate.sh check`). Do **not** require `npm run build` at commit time. `next dev` / UAT ≠ lint/typecheck.
- **Push gate:** production **build paused** before `git push`（太慢）— do **not** require `gate.sh build` / `next build` to push. Commit gate already covers lint+typecheck.
- **On-prem zip/upgrade:** if that commit changes web build inputs, `npm run build -w @mesa/web` must pass **before** `pack-release.sh` (store Docker is where typecheck actually fails — see `.cursor/rules/on-prem-pack.mdc`).
- Fiscal Agent：变更与 tag 在 farvoo-fatura 仓；本仓不跑 Go agent 门禁。
- Migration/RLS: verify tenant isolation; not only happy paths. No broad web unit suite — add targeted tests when justified. Fix narrow failures; do not loop full-project builds on every commit.
- **清冗余 before UAT (hard):** after implement, **before** starting product UAT: scan this task’s surface for dead exports / parallel live forms / forward-only wrappers and remove confirmed finds — see `.cursor/rules/redundancy-cleanup-before-uat.mdc`. Do not start UAT with known redundancy left “以后再清”.
- **UAT machine evidence (hard):** `uat.md` needs `## 测试项` + `## 证据`; append via `gate.sh uat-evidence -- <cmd>` (`exit=0`); narrative-only pass is rejected. Web/ops/packages → evidence must include `mesa-local-uat`.
- **Hook order:** browser MCP blocked on uncommitted product WIP until `gate.sh scan` (report under `.mesa-agent-gates/<branch>/scan.md`); `git commit` blocked until `scan` + `uat` + `check` match the tree fingerprint; `git push` does **not** require a build marker. Any edit invalidates markers.
- **Functional delivery gate:** behavior/UI/API changes need localhost product UAT **pass** (`mesa-local-product-test`) before commit/merge/done — see `.cursor/rules/uat-before-delivery.mdc`. Lint/unit/build alone is not product UAT.
- **Sole index:** product “sole X” retrospectives live in [`docs/agent-sole-index.zh.md`](./docs/agent-sole-index.zh.md) by domain — read the matching section before editing that domain.

## Boundaries

- **Git shipping:** local branch → local merge to `main` → push only when the user asks. Do not open GitHub PRs, enable auto-merge, or push/merge `origin/main` from Cloud/Background Agents unless explicitly asked in-thread. See `.cursor/rules/git-local-merge-push.mdc`.
- Never commit secrets (`.env.local`, keys, JWTs, pairing codes, customer data). Never print env/tokens/cookies in replies.
- New timestamped migrations only; do not weaken RLS, service-role, staff auth, print JWT, rate limits.
- Careful: checkout, billing, transfer/merge, auto-close, print claim. No hard-delete of live tables/ops records unless product requires it.
- No dependency / lockfile changes unless user approves. No destructive commands (`rm -rf`, db reset, force push, etc.) without explicit approval. Never `supabase db reset` without explicit permission in-thread.
- Localhost product UAT (`mesa-local-product-test` / `local-product-testing.mdc`): standing auth for documented accounts, product API writes, and browser MCP on localhost (`user-chrome-devtools` / `cursor-ide-browser`) — no per-step confirm; `.cursor/permissions.json` allowlists browser MCP; only DB wipe still needs ask.
- Stop and ask when requirements/schema/behavior are unclear.

## Token discipline

- Plan 2–4 search/edit bullets before tools. Search before broad reads. Default inspect **3–5** files; if more, stop and explain why / ask. Concise replies; no full-file dumps, pasted code, huge logs, or nonessential progress chatter. Minimal diff **when end-state allows** — not “add onto a duplicated shape and dedupe later.”

## Retrospectives

If the user catches copy-then-dedupe or the same agent mistake twice, update **one line** in the matching domain section of [`docs/agent-sole-index.zh.md`](./docs/agent-sole-index.zh.md) (or the relevant skill) in the same change set — **do not** grow this file’s body with product sole rules.

**Before editing a product domain:** read only that domain’s section in `docs/agent-sole-index.zh.md` (guest-bill / staff-checkout / menu-guest / kitchen-floor / dashboard / print-onprem / platform / process).

**Process reminders (stay here):** commit never without `gate.sh check`; UAT needs machine evidence (`gate.sh uat` + `## 证据`); Cursor uses `.cursor/hooks.json` → same `gate.sh` as Claude/Codex; never stash/restore foreign WIP; land deletes this-task worktree/branch; evidence not fortune-telling — see `.cursor/rules/evidence-based-conclusions.mdc` and `accurate-zh-wording.mdc`.
