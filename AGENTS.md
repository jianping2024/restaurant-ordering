# AGENTS.md

Guidance for AI coding agents in this repository.

## Priority (conflicts)

1. Safety and data protection  
2. Tenant isolation and RLS  
3. User-requested scope  
4. Behavior-change structure — `.cursor/rules/analysis-before-code.mdc` + skill `mesa-analyze-before-code` (end-state shape). Wins over “minimal patch” / “copy nearby layout” when those leave a second representation of the same step/label/mapping  
5. Token-saving (search limits, concise output)  
6. Style / formatting  

Do not broaden the task unless the user asks.

**This file:** stack, commands, repo map, domain invariants, DB how-to, which checks, safety.  
**Not this file:** analyze-first, end-state/reuse gates, branching, commit permission → `analysis-before-code.mdc` + `.cursor/skills/mesa-analyze-before-code/`. Doc nav → `project-rules.mdc`.

## Stack

- Next.js 14 App Router, React 18, TypeScript strict, Tailwind; Supabase (Auth/DB/RLS); Go 1.22 print-agent; Vercel; CI Node 20 + **npm** (`package-lock.json`; no yarn/pnpm/bun unless asked).
- Go only via Docker — do not ask the user to install Go locally.

## Commands

| Action | Command |
|--------|---------|
| Web (local Docker Supabase) | `npm run dev` → `0.0.0.0:3000` |
| Web (cloud) | `npm run cloud` |
| Web (stage) | `npm run stage` |
| Ops | `npm run dev:ops` → `:3001` |
| Lint | `npm run lint` |
| Build web / ops | `npm run build` / `npm run build:ops` |
| Print-agent helpers | `npm run print` / `printstop` / `printlog` |
| Migrations | `supabase db push` (after `supabase link`) |

Print-agent (from repo root; never bare local `go test`/`vet`/`build`):

```bash
docker run --rm -v "$PWD:/repo" -w /repo/apps/print-agent golang:1.22 go test ./...
docker run --rm -v "$PWD:/repo" -w /repo/apps/print-agent golang:1.22 go vet ./...
docker run --rm -v "$PWD:/repo" -w /repo/apps/print-agent -e GOOS=windows -e GOARCH=amd64 golang:1.22 go build -o /dev/null .
```

## Layout

- `apps/web` — tenant product (`@/*` → `src/*`)
- `apps/ops` — platform ops
- `packages/shared` — `@mesa/shared`
- `apps/print-agent` — Go agent
- `supabase/migrations` — append only; do not edit applied history
- `docs/` — product/design/technical truth

## Coding invariants

- Prefer nearby **idiom/style**; do **not** copy a parallel data/copy shape when analysis requires one end-state representation. Do not add private mint helpers that only wrap/forward into a public twin — one function per capability. Runtime auth is `can`/`requirePermission` only — never add a parallel role/mode whitelist beside capability. Middleware session bypass lives only in `middleware-session-policy.ts` (matcher + early-return). Dashboard list **date-range** UI is two `@mesa/ui` `DatePicker`s (start + end); do not add a parallel `DayPicker mode="range"` / `DashboardDateRangePicker` for the same filter job. Dashboard filterable lists (operation logs, abnormal ops, dish history) fetch only via `useDashboardListQuery` (one query snapshot, abortable, keep previous rows while loading) — do not reintroduce parallel `debouncedFilters` + `page` dual-trigger `load` effects.
- **No API polling except named realtime fallback** — see `.cursor/rules/no-polling-except-fallback.mdc` (lifecycle one-shots OK; interval fetch of read models forbidden).
- Scope to requested behavior; `@/*` imports; no service keys on the client; restaurant-scoped queries/APIs.
- UI: `src/components/ui` + brand tokens.
- Tables: `table_id` = UUID; `display_name` = label; print payloads need both; no legacy `table_number`; receipts never show table UUIDs.
- **On-screen dish name:** sole picker `resolveMenuItemLocalizedName` (UI lang + snapshot trilingual); print stays `menuLocalizedName` + `print_locale`. Do not add `item.name || item.name_pt` beside it.
- **Recommended dishes:** sole list `menu_recommended_items` + catalog `recommendedItemIds`; customer merchandising is one `CustomerRecommendedRail` poster card (locked 4:3 well + two-line `recommendedName` slot + `formatCustomerMenuItemPrice` on one baseline; tap opens detail). Do not overlay `MenuItemAddButton`, reuse `MenuItemCard`, clip the band with `overflow-hidden`, add `is_recommended` on `menu_items`, or a real/virtual `recommended` category. Dashboard add is one `POST` `{ menu_item_ids }` (array even for one dish); do not keep a parallel `menu_item_id` add body.
- **Dish history list:** sole page is Lisbon today (`created_at`/`added_at`) + `{ items, page, pageSize, total }` + `ListPaginationBar` (10/20); `session_open` from restaurant `open`/`billing` sessions. Do not `.in('id', sessionIds)`, cursor/`loadMore`, or a parallel 20/50/100 page-size set.
- **Staff catalog list thumb:** sole `MenuItemListThumb` (40×40 photo else emoji); do not inline a second 40×40 `Image` in MenuManager / recommended picker. Guest cards stay `MenuItemCard`.
- **Menu dish list row:** sole on-screen title `formatMenuCatalogItemLabel`; identity (name+meta) separate from actions. Mobile stacks name → meta → one compact action cluster (`€` + thin toggle + text edit/delete, `gap-3` + extra `mr-1.5` after toggle so switch≠edit cramped, no `justify-between` desert). Desktop keeps identity left and the same cluster right-aligned. Do not put price/toggle/actions on the same band as the dish name; do not keep a `⋯` overflow menu or PT·EN·ZH one-line truncate for the list title.
- **Dashboard today amount card:** sole display `€{todayRevenue} + €{diningUncollectedAmount}` (已收 + 未收); uncollected per live session only via `liveSessionUncollectedAmount` (requested split → checkout `pending`, else billable − collected). Do not sum floor `sessionTotal` / raw `orders.total_amount` beside it.
- **Value-analytics dish ranking:** sole UI is month|quarter|year period pickers (from earliest restaurant daily stats through current, no future) + paginated qty ranking from `GET /api/analytics/menu-item-consumption` (`analytics_daily_menu_item_consumption` + today live); click rank toggles `sort=asc|desc` (absolute ranks kept). Do not reintroduce Top10/`topItems` or bind ranking to overview day/week grains.
- **Kitchen ready-after minutes:** sole editor `FeatureFlagsManager` + `PATCH /api/restaurant/features` (`settings.features.manage`); do not keep `KitchenHubReadyAfterSetting` or `…/staff/kitchen/settings`.
- **Browser UUID:** sole mint `mintBrowserUuid` (randomUUID or getRandomValues v4); guest `client_id` and append `client_request_id` both call it. Do not add a `Date.now().toString(16)` fallback beside it.
- Go: Docker commands above; `gofmt`; focused table-driven tests for parser/routing.

## Database

- Schema: read `docs/ai-schema.md` first. Open migrations only for exact SQL/RLS/indexes/defaults. Update `ai-schema.md` when schema changes.

## Checks

- Web: `npm run lint`; also `npm run build` when touching `apps/web/src/app|lib|types`, env, or build config. Ops/shared: `npm run build:ops`. **On-prem zip/upgrade:** if that commit changes web build inputs, `npm run build -w @mesa/web` must pass **before** `pack-release.sh` (store Docker is where typecheck actually fails — see `.cursor/rules/on-prem-pack.mdc`).
- Print-agent: Docker `go test` + `go vet` + Windows cross-build (above).
- Migration/RLS: verify tenant isolation; not only happy paths. No broad web unit suite — add targeted tests when justified. Fix narrow failures; do not loop full-project builds.
- **Functional delivery gate:** behavior/UI/API changes need localhost product UAT **pass** (`mesa-local-product-test`) before commit/merge/done — see `.cursor/rules/uat-before-delivery.mdc`. Lint/unit alone is not delivery.

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

If the user catches copy-then-dedupe or the same agent mistake twice, update **one line** in this file or the relevant skill in the same change set — do not only fix the product code. **Value-analytics dish ranking:** sole month|quarter|year period + paginated list from `menu-item-consumption`; never Top10/`topItems` beside dashboard today top-selling; never bind ranking to overview day/week. **Dashboard today amount card:** `€todayRevenue + €diningUncollectedAmount`; uncollected only via `liveSessionUncollectedAmount` — never parallel floor `sessionTotal` sum. **Menu dish list row:** identity separate from actions (mobile stack / desktop identity-left + compact action cluster right); one cluster for €+thin toggle+text edit/delete (`gap-3`, extra air after toggle) — never `justify-between` price∥controls desert, never switch jammed on 编辑, never name∥price/toggle on one band, never list `⋯` overflow, never PT·EN·ZH one-line title. **Kitchen ready-after minutes:** sole `FeatureFlagsManager` + `PATCH /api/restaurant/features`; do not keep a Hub card or `…/staff/kitchen/settings`. **Customer recommended merchandising:** sole `CustomerRecommendedRail` poster card (4:3 + catalog label + price, tap opens detail); do not keep a strip sentinel `recommended` or overlay `MenuItemAddButton` / reuse `MenuItemCard` on the rail. **Recommended add POST:** sole `{ menu_item_ids }`; do not keep a parallel `menu_item_id` add body. **Staff catalog list thumb:** sole `MenuItemListThumb` (40×40 photo else emoji); do not inline a second 40×40 `Image` in MenuManager / recommended picker. **On-prem 店主影子：** sole owner restaurant load is `loadOwnerRestaurantForUser` (`owner_id` or claimed-store prem `admin`); do not keep `loadOwnerForSlug` owner_id-only beside it — staff APIs and dashboard share that one call. **LAN HTTP UUID:** sole `mintBrowserUuid`; do not mint guest ids with `Date.now().toString(16)` beside the append getRandomValues path. **Client IP for rate limits:** sole `clientIpFromRequest` — prefer `CF-Connecting-IP`, else rightmost `X-Forwarded-For` hop, never leftmost-spoofable-first as the trusted visitor. **Menu item allergens:** sole `menu_items.allergen_codes` + `normalizeAllergenCodes` / `ALLERGENS` in `lib/allergens.ts` (EU 14); do not store contains-allergens on `note_preset_keys` or invent a parallel shellfish code. **Evidence, not fortune-telling:** never present 多半/应该是/大概 as root cause; conclusions need checkable evidence (code/DB/log/repro); label gaps as 未证实 — see `.cursor/rules/evidence-based-conclusions.mdc`. **Evidence, not fortune-telling:** never present 多半/应该是/大概 as root cause; conclusions need checkable evidence (code/DB/log/repro); label gaps as 未证实 — see `.cursor/rules/evidence-based-conclusions.mdc`. **On-prem pack after web/lib/font change:** `pack-release` only zips; store `next build` is the real typecheck — run `npm run build -w @mesa/web` on that commit before zip/upgrade; `next/font/local` `adjustFontFallback` is `false|'Arial'|'Times New Roman'`, never `true` (Google-font boolean). **Chrome / top-bar layout UAT:** presence of copy or a CSS class is not enough — screenshot the bar and assert the new control shares the designed row/alignment with neighbors (e.g. same vertical mid as the account menu); stretched flex items with top-aligned text will look like a second row. **Docs-only on-prem build advice is a mistake:** agreed Dockerfile/migrate gates must land in code + `pack-release` fail-closed before the next zip (see `.cursor/rules/on-prem-pack.mdc`). **Mode B same-origin URL without matching auth cookie name** (`getSupabaseAuthCookieOptions` ↔ `kong` host) leaves Realtime anon and drops CDC — do not ship same-origin alone. **Tunnel `X-Forwarded-Proto=http` / Mode B:** claim `supabase_url` prefers agent `api_base` only when `NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`; cloud claim always `getPublishedSupabaseUrl()`. Dashboard downloads use relative `/api/downloads/...` and pair `api=` uses `window.location.origin`. **Pair success:** sole browser exit is `location.replace('/configure')`; Connected re-pair uses in-process `rebindTrayAgentWork` (not process restart) after `/api/pair` flush — never paint `#err` after ok. **Inno Setup upgrade:** sole path is `PrivilegesRequired=admin` + `PrepareToInstall` taskkill of `MesaPrintAgent.exe` (no `AppMutex`, no CloseApplications yes/no) + `restartreplace` — do not leave `PrivilegesRequired=lowest` or `AppMutex` beside that story. **On-prem claim:** pack ships URL only; store `leaseSecret`/`checkinCredential` come from Ops claim → `license-state/platform.json` — do not require env lease secret for `/setup`. **顾头不顾腚:** before “不用改 / 不用 push / 只重试某一步”, check the **whole producer→consumer path on what is actually running** (caller expectations vs deployed callee; local branch ahead of `origin`/prod = gap). Do not answer from one step’s happy path while the other side’s live contract is unverified. **顾头不顾腚 (protocol/deploy):** before “不用 push / 再签码即可”, verify the **full producer→consumer contract on what is actually deployed** (e.g. store build expects `leaseSecret` in claim JSON ⇒ `origin/main` + live Ops must already return it); local `main` ahead of `origin` is a deploy gap, not “recovery needs no Ops change.” **开台确认：** idle confirm is one `POST …/buffet` with `intent` (`open`|`save`); stale guard is server `409 already_open` only — never a confirm-time GET table precheck. **Workspace root / 切分支：** 开发期切分支、进 worktree、合进 main **一律 shell**（`git checkout` / `worktree add|remove`）；**不要**为“切过去”调 `move_agent_to_root` / `move_agent_to_cloned_root`——二者会 `git fetch origin <对话先前分支>`，本地-only 分支必炸。主仓路径能 `checkout main` 就够；MCP root 挪不动就用绝对路径继续改，事后再报。 **合进 main 收尾：** user-asked land/merge 后必须删本任务 feature worktree + 本地 feature 分支并把**主仓**切到 `main`（见 `git-local-merge-push.mdc`）；**禁止**为收尾调用 `move_agent_to_root` / `move_agent_to_cloned_root`（含“切回主仓”）——一律 shell；**假完成：** `git worktree list` 无登记但目录壳还在 ≠ 收尾——须 `test ! -e <path>`，壳残留则对该 throwaway path `rm -rf`；stash/冲突不得打断 done-gate。 **楼面跨端：** 一直亮着的桌面只靠 Realtime；手机回前台有 visibility 兜底。只修 published bridge 不够——`useRestaurantStaffEntryReconcile` 必须含 window focus catch-up（与 visibility 同一 resume 路径，勿在 Realtime transport 再挂一份 focus）。 **楼面跨端 UAT：** 禁止用 `select_page` 在被动页断言前切走再切回当「同步证明」（会触发 focus/visibility catch-up，假通过）；被动页保持前台，用 API 改态，再 `wait_for`/`evaluate_script`。Docker 挂掉/本地库被清 ≠ 产品不同步——先 `ready`/登录，再谈 Realtime；绿场 `db reset` 会卡在残缺 `initial_schema`，需 cloud schema+data 恢复后再 `db push` 本地-only 迁移。 **权限勾选文案：** 角色权限编辑器唯一 IA 为 `ROLE_PERMISSION_PAGE_TREE`（产品页面树）；设置子页（含后厨大屏）只作为「餐厅设置」子节点出现一次，label 读 `settingsHub`/`nav`。开台与保存人数唯一 key 为 `tables.open_session`；楼面看板唯一 key 为 `dashboard.waiter_board.view`。 **厨房权限唯一：** 进 `/{slug}/kitchen` 与员工顶栏厨房入口共用唯一 key `floor.kitchen_board.view`；禁止再挂平行 `dashboard.kitchen_shortcut.view` / 第二行「厨房看板」文案。 **测试端口冲突：** 占用中的 `:3000`/`:3001` 不要 kill；另起空闲端口并用 `MESA_UAT_BASE`（见 `.cursor/rules/dev-port-isolation.mdc`）。 **本地服务收尾：** 开发/UAT/合进 main 后须保留可用 web（及本线程用过的 local Supabase）方便复测；只停本线程多余进程；禁止收尾时 kill 其他 session 的 agent/dev，也禁止为清理而 `db reset`/删本地库（见 `.cursor/rules/local-dev-services.mdc`）。 **POS-80 / 80mm 纸：** 可打点宽 **576**（Font A 48 列 × **12** dots）；Han/GS v 0 画布必须 576。**禁止**把 `384=48×8` 当满纸——那会让 Qty 永远停在纸宽约 3/4 处（见 `docs/technical/print-agent-station-slip-han-canvas.zh.md`）。 **历史订单列表：** 唯一 feed 路径是 SQL RPC `order_history_feed_page`（closed∪transfer 排序分页）+ 当页 `loadOrdersForOrderHistoryPage` hydrate；禁止全窗口 `.in(session_id)` 或应用层双源 merge 后再切片，禁止查询失败 `EMPTY_PAGE` 吞错（Kong `URI too long` 会伪装成「暂无历史订单」）。 **当日菜品检索：** 唯一列表是里斯本当天 + `{ items, page, pageSize, total }` + 本店 `open`/`billing` 会话 Set 标 `session_open`；禁止 `.in('id', sessionIds)`（Kong `URI too long`）、cursor/`loadMore`、20/50/100 平行档位。 **后台管理员（`owner_id`）capabilities：** 唯一写法是 `resolveCapabilitiesForOwner() → '*'`；顶栏/中间件也只认 `can(capabilities)`（无平行 `OWNER_NAV_*` / owner path 白名单）；禁止再拼 `ROLE_TEMPLATES.owner` + settings 补丁列表；店主员工 preset 仍走 `restaurant_roles.permissions`。 **厨房备餐 401：** 与看板 refresh 同一写法——`classifyStaffBoardFetchFailure` → `unauthorized` → `handleSignOut()`；禁止再对 session 401 画「备餐失败，请重试」。 **部署到 prem：** Will 口令仅要求 pack → scp → 店机解压到 `/home/remoteadmin/mesa-on-prem-<ver>/`；**不要**代跑 `sudo upgrade.sh`（店机无免密 sudo）；交还 stamped 路径与升级命令给 Will。 **Realtime RLS + 嵌套 EXISTS：** 顾客 anon 的 `postgres_changes` 若策略 `EXISTS (SELECT … FROM table_sessions …)`，会被 `table_sessions` 自身 RLS 挡成永远不可见 → 订阅成功但无 CDC 载荷；须 `SECURITY DEFINER` 会话态检查（如 `table_session_is_open_or_billing`），勿直接 EXISTS 读 sessions。 **Customer menu SSR / Element type undefined：** `MenuPage` 图里的 client 模块禁止 value-import `@supabase/supabase-js`（`serverComponentsExternalPackages` 会让 webpack 标成 async → `MenuPage` client ref `async:true` → RSC 报 `Element type is invalid` / got undefined，客户端再恢复）；只 `import type` + 订阅状态字面量。 **Floor-card fixed slots:** sole geometry is always-on `cardOpenerSlot` + `cardAmountSlot` + `cardStatusSlot` + status-rail `cardRailBelow*` (empty when idle) + one-line `cardMeta`; do not omit opener/status/rail bands by board state or reintroduce `flex-wrap` meta that changes hall card height. **On-prem pack zip bloat:** rsync must exclude `.next` **and** `.next-*` (`.next-uat` / `.next-typecheck`); after pack assert zip ~few MB and no `.next*` in stage — never scp a hundreds-of-MB “source” zip (see `pack-release.sh` fail-closed gate).
