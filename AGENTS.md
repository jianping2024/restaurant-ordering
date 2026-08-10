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

- Prefer nearby **idiom/style**; do **not** copy a parallel data/copy shape when analysis requires one end-state representation. Do not add private mint helpers that only wrap/forward into a public twin — one function per capability. Runtime auth is `can`/`requirePermission` only — never add a parallel role/mode whitelist beside capability. Middleware session bypass lives only in `middleware-session-policy.ts` (matcher + early-return). Dashboard list **date-range** UI is two `@mesa/ui` `DatePicker`s (start + end); do not add a parallel `DayPicker mode="range"` / `DashboardDateRangePicker` for the same filter job.
- **No API polling except named realtime fallback** — see `.cursor/rules/no-polling-except-fallback.mdc` (lifecycle one-shots OK; interval fetch of read models forbidden).
- Scope to requested behavior; `@/*` imports; no service keys on the client; restaurant-scoped queries/APIs.
- UI: `src/components/ui` + brand tokens.
- Tables: `table_id` = UUID; `display_name` = label; print payloads need both; no legacy `table_number`; receipts never show table UUIDs.
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

If the user catches copy-then-dedupe or the same agent mistake twice, update **one line** in this file or the relevant skill in the same change set — do not only fix the product code. **Evidence, not fortune-telling:** never present 多半/应该是/大概 as root cause; conclusions need checkable evidence (code/DB/log/repro); label gaps as 未证实 — see `.cursor/rules/evidence-based-conclusions.mdc`. **Evidence, not fortune-telling:** never present 多半/应该是/大概 as root cause; conclusions need checkable evidence (code/DB/log/repro); label gaps as 未证实 — see `.cursor/rules/evidence-based-conclusions.mdc`. **On-prem pack after web/lib/font change:** `pack-release` only zips; store `next build` is the real typecheck — run `npm run build -w @mesa/web` on that commit before zip/upgrade; `next/font/local` `adjustFontFallback` is `false|'Arial'|'Times New Roman'`, never `true` (Google-font boolean). **Chrome / top-bar layout UAT:** presence of copy or a CSS class is not enough — screenshot the bar and assert the new control shares the designed row/alignment with neighbors (e.g. same vertical mid as the account menu); stretched flex items with top-aligned text will look like a second row. **Docs-only on-prem build advice is a mistake:** agreed Dockerfile/migrate gates must land in code + `pack-release` fail-closed before the next zip (see `.cursor/rules/on-prem-pack.mdc`). **Mode B same-origin URL without matching auth cookie name** (`getSupabaseAuthCookieOptions` ↔ `kong` host) leaves Realtime anon and drops CDC — do not ship same-origin alone. **Tunnel `X-Forwarded-Proto=http` / Mode B:** claim `supabase_url` prefers agent `api_base` only when `NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`; cloud claim always `getPublishedSupabaseUrl()`. Dashboard downloads use relative `/api/downloads/...` and pair `api=` uses `window.location.origin`. **Pair success:** sole browser exit is `location.replace('/configure')`; Connected re-pair uses in-process `rebindTrayAgentWork` (not process restart) after `/api/pair` flush — never paint `#err` after ok. **Inno Setup upgrade:** sole path is `PrivilegesRequired=admin` + `PrepareToInstall` taskkill of `MesaPrintAgent.exe` (no `AppMutex`, no CloseApplications yes/no) + `restartreplace` — do not leave `PrivilegesRequired=lowest` or `AppMutex` beside that story. **On-prem claim:** pack ships URL only; store `leaseSecret`/`checkinCredential` come from Ops claim → `license-state/platform.json` — do not require env lease secret for `/setup`. **顾头不顾腚:** before “不用改 / 不用 push / 只重试某一步”, check the **whole producer→consumer path on what is actually running** (caller expectations vs deployed callee; local branch ahead of `origin`/prod = gap). Do not answer from one step’s happy path while the other side’s live contract is unverified. **顾头不顾腚 (protocol/deploy):** before “不用 push / 再签码即可”, verify the **full producer→consumer contract on what is actually deployed** (e.g. store build expects `leaseSecret` in claim JSON ⇒ `origin/main` + live Ops must already return it); local `main` ahead of `origin` is a deploy gap, not “recovery needs no Ops change.” **开台确认：** idle confirm is one `POST …/buffet` with `intent` (`open`|`save`); stale guard is server `409 already_open` only — never a confirm-time GET table precheck. **Workspace root / 切分支：** 开发期切分支、进 worktree、合进 main **一律 shell**（`git checkout` / `worktree add|remove`）；**不要**为“切过去”调 `move_agent_to_root` / `move_agent_to_cloned_root`——二者会 `git fetch origin <对话先前分支>`，本地-only 分支必炸。主仓路径能 `checkout main` 就够；MCP root 挪不动就用绝对路径继续改，事后再报。 **合进 main 收尾：** user-asked land/merge 后必须删本任务 feature worktree + 本地 feature 分支并把**主仓**切到 `main`（见 `git-local-merge-push.mdc`）；**禁止**为收尾调用 `move_agent_to_root` / `move_agent_to_cloned_root`（含“切回主仓”）——一律 shell；**假完成：** `git worktree list` 无登记但目录壳还在 ≠ 收尾——须 `test ! -e <path>`，壳残留则对该 throwaway path `rm -rf`；stash/冲突不得打断 done-gate。 **楼面跨端：** 一直亮着的桌面只靠 Realtime；手机回前台有 visibility 兜底。只修 published bridge 不够——`useRestaurantStaffEntryReconcile` 必须含 window focus catch-up（与 visibility 同一 resume 路径，勿在 Realtime transport 再挂一份 focus）。 **楼面跨端 UAT：** 禁止用 `select_page` 在被动页断言前切走再切回当「同步证明」（会触发 focus/visibility catch-up，假通过）；被动页保持前台，用 API 改态，再 `wait_for`/`evaluate_script`。Docker 挂掉/本地库被清 ≠ 产品不同步——先 `ready`/登录，再谈 Realtime；绿场 `db reset` 会卡在残缺 `initial_schema`，需 cloud schema+data 恢复后再 `db push` 本地-only 迁移。 **权限勾选文案：** 角色权限编辑器唯一 IA 为 `ROLE_PERMISSION_PAGE_TREE`（产品页面树）；设置子页（含后厨大屏）只作为「餐厅设置」子节点出现一次，label 读 `settingsHub`/`nav`。开台与保存人数唯一 key 为 `tables.open_session`；楼面看板唯一 key 为 `dashboard.waiter_board.view`。 **测试端口冲突：** 占用中的 `:3000`/`:3001` 不要 kill；另起空闲端口并用 `MESA_UAT_BASE`（见 `.cursor/rules/dev-port-isolation.mdc`）。 **POS-80 / 80mm 纸：** 可打点宽 **576**（Font A 48 列 × **12** dots）；Han/GS v 0 画布必须 576。**禁止**把 `384=48×8` 当满纸——那会让 Qty 永远停在纸宽约 3/4 处（见 `docs/technical/print-agent-station-slip-han-canvas.zh.md`）。
