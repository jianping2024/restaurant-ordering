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

- Prefer nearby **idiom/style**; do **not** copy a parallel data/copy shape when analysis requires one end-state representation. Do not add private mint helpers that only wrap/forward into a public twin — one function per capability. Runtime auth is `can`/`requirePermission` only — never add a parallel role/mode whitelist beside capability. Middleware session bypass lives only in `middleware-session-policy.ts` (matcher + early-return).
- **No API polling except named realtime fallback** — see `.cursor/rules/no-polling-except-fallback.mdc` (lifecycle one-shots OK; interval fetch of read models forbidden).
- Scope to requested behavior; `@/*` imports; no service keys on the client; restaurant-scoped queries/APIs.
- UI: `src/components/ui` + brand tokens.
- Tables: `table_id` = UUID; `display_name` = label; print payloads need both; no legacy `table_number`; receipts never show table UUIDs.
- Go: Docker commands above; `gofmt`; focused table-driven tests for parser/routing.

## Database

- Schema: read `docs/ai-schema.md` first. Open migrations only for exact SQL/RLS/indexes/defaults. Update `ai-schema.md` when schema changes.

## Checks

- Web: `npm run lint`; also `npm run build` when touching `apps/web/src/app|lib|types`, env, or build config. Ops/shared: `npm run build:ops`.
- Print-agent: Docker `go test` + `go vet` + Windows cross-build (above).
- Migration/RLS: verify tenant isolation; not only happy paths. No broad web unit suite — add targeted tests when justified. Fix narrow failures; do not loop full-project builds.

## Boundaries

- **Git shipping:** local branch → local merge to `main` → push only when the user asks. Do not open GitHub PRs, enable auto-merge, or push/merge `origin/main` from Cloud/Background Agents unless explicitly asked in-thread. See `.cursor/rules/git-local-merge-push.mdc`.
- Never commit secrets (`.env.local`, keys, JWTs, pairing codes, customer data). Never print env/tokens/cookies in replies.
- New timestamped migrations only; do not weaken RLS, service-role, staff auth, print JWT, rate limits.
- Careful: checkout, billing, transfer/merge, auto-close, print claim. No hard-delete of live tables/ops records unless product requires it.
- No dependency / lockfile changes unless user approves. No destructive commands (`rm -rf`, db reset, force push, etc.) without explicit approval. Never `supabase db reset` without explicit permission in-thread.
- Localhost product UAT (`mesa-local-product-test` / `local-product-testing.mdc`): standing auth for documented accounts, product API writes, and browser MCP on localhost (`user-chrome-devtools` / `cursor-ide-browser`) — no per-step confirm; `.cursor/permissions.json` allowlists browser MCP; only DB wipe still needs ask.
- Stop and ask when requirements/schema/behavior are unclear.

## Token discipline

- Plan 2–4 search/edit bullets before tools. Search before broad reads. Default inspect **3–5** files; if more, stop and explain why / ask. Concise replies; no full-file dumps or huge logs. Minimal diff **when end-state allows** — not “add onto a duplicated shape and dedupe later.”

## Retrospectives

If the user catches copy-then-dedupe or the same agent mistake twice, update **one line** in this file or the relevant skill in the same change set — do not only fix the product code. **Chrome / top-bar layout UAT:** presence of copy or a CSS class is not enough — screenshot the bar and assert the new control shares the designed row/alignment with neighbors (e.g. same vertical mid as the account menu); stretched flex items with top-aligned text will look like a second row. **Docs-only on-prem build advice is a mistake:** agreed Dockerfile/migrate gates must land in code + `pack-release` fail-closed before the next zip (see `.cursor/rules/on-prem-pack.mdc`). **Mode B same-origin URL without matching auth cookie name** (`getSupabaseAuthCookieOptions` ↔ `kong` host) leaves Realtime anon and drops CDC — do not ship same-origin alone. **Tunnel `X-Forwarded-Proto=http`:** claim `supabase_url` prefers agent `api_base`; dashboard downloads use relative `/api/downloads/...` and pair `api=` uses `window.location.origin`. **Pair success:** sole browser exit is `location.replace('/configure')`; Connected re-pair restart stays in `onPairConfigSaved` but deferred after `/api/pair` flush — never paint `#err` after ok. **Inno Setup upgrade:** sole path is `PrivilegesRequired=admin` + `AppMutex`/`CloseApplications` matching `agentMutexName` — do not leave `PrivilegesRequired=lowest` beside an admin story. **On-prem claim:** pack ships URL only; store `leaseSecret`/`checkinCredential` come from Ops claim → `license-state/platform.json` — do not require env lease secret for `/setup`. **顾头不顾腚:** before “不用改 / 不用 push / 只重试某一步”, check the **whole producer→consumer path on what is actually running** (caller expectations vs deployed callee; local branch ahead of `origin`/prod = gap). Do not answer from one step’s happy path while the other side’s live contract is unverified. **顾头不顾腚 (protocol/deploy):** before “不用 push / 再签码即可”, verify the **full producer→consumer contract on what is actually deployed** (e.g. store build expects `leaseSecret` in claim JSON ⇒ `origin/main` + live Ops must already return it); local `main` ahead of `origin` is a deploy gap, not “recovery needs no Ops change.” **开台确认：** idle confirm is one `POST …/buffet` with `intent` (`open`|`save`); stale guard is server `409 already_open` only — never a confirm-time GET table precheck. **Workspace root / 切分支：** never `move_agent_to_root` / `move_agent_to_cloned_root` when the conversation’s prior branch is local-only (no `origin/<branch>`) — both still `git fetch origin` that branch and explode; switch with shell `git checkout` / `git worktree remove|add` only, edit via absolute worktree paths if MCP root cannot move. **合进 main 收尾：** user-asked land/merge 后必须删本任务 feature worktree + 本地 feature 分支并回到 `main`（见 `git-local-merge-push.mdc`）；不要停在功能分支等用户再催一次。
