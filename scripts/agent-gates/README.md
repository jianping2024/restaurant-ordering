# Agent delivery gates（Claude Code · Codex · Cursor 共用）

**唯一执行入口：** `bash scripts/agent-gates/gate.sh <cmd>`  
**策略正文也写在根目录 `AGENTS.md` → Checks**（Codex / Claude / Cursor 都会读）。  
Cursor 的 `.cursor/rules/lint-build-before-commit.mdc` / `push-verification.mdc` 只是同一策略的镜像，改规则时以本目录 + `AGENTS.md` 为准。

## 门禁分工

| 时机 | 要求 | 命令 |
|---|---|---|
| **commit 前** | scoped **lint + typecheck**（不要 `next build`） | `gate.sh check` |
| **push 前** | **不**强制 production build（已暂停，太慢） | — |
| 产品改动交付 | 清冗余 → UAT（含机器证据）→ 再 check → commit | `gate.sh scan` → `uat-evidence`… → `uat` → `check` |
| **pack / on-prem zip**（web 输入有变） | production build | `gate.sh build`（见 `on-prem-pack.mdc`） |

### 作用面（按 diff）

- Web / `packages/*` → `npm run lint -w @mesa/web` + `npm run typecheck -w @mesa/web`（`tsconfig.typecheck.json`，排除 `*.test.ts`；与 `next build` 产品面一致，不拿测试夹具当 commit 硬门）
- Ops / `packages/*` → `npm run lint -w @mesa/ops` + `npm run typecheck -w @mesa/ops`（同上）
- Print-agent：**commit** → Docker `go vet`；pack/tag 前再按 `AGENTS.md` 做 `go test` / 交叉编译（不挡日常 `git push`）

### 禁止

- commit 前跑整仓 `npm run build` 当硬门（太慢）
- commit 跳过 lint+typecheck 指望 CI 拦
- 用 `next dev` / UAT 代替 lint、typecheck
- **只写叙述式 pass、无 `## 证据` / 无 `exit=0`**（`gate.sh uat` 会拒）
- 店机 pack/升级前跳过已要求的 web `build`（那是 pack 门，不是 push 门）

## 命令

```bash
bash scripts/agent-gates/gate.sh scan           # 校验 scan.md，记清冗余标记
bash scripts/agent-gates/gate.sh uat-evidence -- node scripts/mesa-local-uat.mjs stack-health
bash scripts/agent-gates/gate.sh uat-evidence -- node scripts/mesa-local-uat.mjs login --role owner --jar lucky
bash scripts/agent-gates/gate.sh uat            # 校验 uat.md（## 测试项 + ## 证据），记 UAT 标记
bash scripts/agent-gates/gate.sh check          # lint + typecheck → commit 门禁
bash scripts/agent-gates/gate.sh build          # next build（独立 distDir）→ pack/on-prem 可选；不挡 push
bash scripts/agent-gates/gate.sh status
```

标记目录：`.mesa-agent-gates/<branch>/`（gitignore；按产品树指纹失效）。

### UAT 报告格式（硬）

`uat.md` 必须同时有：

1. **`## 测试项`** — 逐项 `pass` / `通过`；有 `fail` / `未通过` 则拒
2. **`## 证据`** — 机器可核对行，禁止纯叙述。推荐用 `uat-evidence` 追加，形如：

```markdown
## 证据

- 2026-10-21T12:00:00Z `node scripts/mesa-local-uat.mjs stack-health` exit=0
- 2026-10-21T12:00:05Z `node scripts/mesa-local-uat.mjs login --role owner --jar lucky` exit=0
```

规则：

- 至少一行 `exit=0`；任一非零 `exit=` → 拒
- 改动含 `apps/web` / `apps/ops` / `packages` → 证据须含 `mesa-local-uat`
- **仅** `apps/print-agent` → 证据须含 `go vet` / `go test` / `mesa-print-smoke` 之一

## 钩子（强制执行同一脚本）

| 工具 | 配置 | 行为 |
|---|---|---|
| Claude Code | `.claude/settings.json` → `gate.sh hook-commit` / `hook-browser` | PreToolUse 拦 `git commit` / 浏览器测 |
| Codex | `.codex/hooks.json` → `gate.sh hook-commit` / `hook-push` | PreToolUse 拦 `git commit`；`hook-push` 仍挂着但不拦 build |
| Cursor | `.cursor/hooks.json` → `.cursor/hooks/mesa-gate-*.sh` → 同一 `gate.sh` | `beforeShellExecution` 拦含 `git` 的 commit/push；`beforeMCPExecution` 拦浏览器 MCP（未清冗余） |

首次在 Codex 启用项目 hook 时，在 `/hooks` 里 **review + trust** 本仓库的 `.codex/hooks.json`（改 hook 后要重新 trust）。  
Cursor：Hooks 设置页应能看到本仓库 hooks；改 `hooks.json` 后若未加载可重载窗口。

`hook-commit` / `hook-push` / Cursor 适配脚本：失败时 **exit 2 + stderr**（Cursor 另回 `permission: deny` JSON）。

### Worktree / 旁路 WIP（硬）

- Hook 会从 shell 命令里的 `cd <path>` / `git -C <path>` **改绑**到实际提交/推送的 worktree，再算指纹与 `.mesa-agent-gates/<branch>/` 标记。
- Agent **禁止**用 `git stash` 清掉主仓/旁路分支的未提交改动，只为让 hook 放行另一 worktree 的 commit（见 `.cursor/rules/feature-branch-before-code.mdc`）。
- `git stash push` **不是** remote push；`hook-push` 会忽略含 `git stash` 的命令。
- 正确做法：本任务专用 worktree 内跑 `gate.sh scan|uat|check` 再 `cd` 该 worktree `git commit`。门禁仍看错树 → **停下来报**，不要 stash。
