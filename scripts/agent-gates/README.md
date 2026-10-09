# Agent delivery gates（Claude Code · Codex · Cursor 共用）

**唯一执行入口：** `bash scripts/agent-gates/gate.sh <cmd>`  
**策略正文也写在根目录 `AGENTS.md` → Checks**（Codex / Claude 都会读）。  
Cursor 的 `.cursor/rules/lint-build-before-commit.mdc` / `push-verification.mdc` 只是同一策略的镜像，改规则时以本目录 + `AGENTS.md` 为准。

## 门禁分工

| 时机 | 要求 | 命令 |
|---|---|---|
| **commit 前** | scoped **lint + typecheck**（不要 `next build`） | `gate.sh check` |
| **push 前** | **不**强制 production build（已暂停，太慢） | — |
| 产品改动交付 | 清冗余 → UAT → 再 check → commit | `gate.sh scan` → `uat` → `check` |
| **pack / on-prem zip**（web 输入有变） | production build | `gate.sh build`（见 `on-prem-pack.mdc`） |

### 作用面（按 diff）

- Web / `packages/*` → `npm run lint -w @mesa/web` + `npm run typecheck -w @mesa/web`（`tsconfig.typecheck.json`，排除 `*.test.ts`；与 `next build` 产品面一致，不拿测试夹具当 commit 硬门）
- Ops / `packages/*` → `npm run lint -w @mesa/ops` + `npm run typecheck -w @mesa/ops`（同上）
- Print-agent：**commit** → Docker `go vet`；pack/tag 前再按 `AGENTS.md` 做 `go test` / 交叉编译（不挡日常 `git push`）

### 禁止

- commit 前跑整仓 `npm run build` 当硬门（太慢）
- commit 跳过 lint+typecheck 指望 CI 拦
- 用 `next dev` / UAT 代替 lint、typecheck
- 店机 pack/升级前跳过已要求的 web `build`（那是 pack 门，不是 push 门）

## 命令

```bash
bash scripts/agent-gates/gate.sh scan      # 校验 .mesa-agent-gates/<branch>/scan.md，记清冗余标记
bash scripts/agent-gates/gate.sh uat       # 校验 uat.md（## 测试项，无 fail）
bash scripts/agent-gates/gate.sh check     # lint + typecheck → commit 门禁
bash scripts/agent-gates/gate.sh build     # next build（独立 distDir）→ pack/on-prem 可选；不挡 push
bash scripts/agent-gates/gate.sh status
```

标记目录：`.mesa-agent-gates/<branch>/`（gitignore；按产品树指纹失效）。

## 钩子（强制执行同一脚本）

| 工具 | 配置 | 行为 |
|---|---|---|
| Claude Code | `.claude/settings.json` → `gate.sh hook-commit` / `hook-browser` | PreToolUse 拦 `git commit` / 浏览器测 |
| Codex | `.codex/hooks.json` → `gate.sh hook-commit` / `hook-push` | PreToolUse 拦 `git commit`；`hook-push` 仍挂着但不拦 build |
| Cursor | 无强制 hook；agent 须遵守 `AGENTS.md` + 镜像 rules | 人工/agent 自觉跑 `check`；push 不跑 build |

首次在 Codex 启用项目 hook 时，在 `/hooks` 里 **review + trust** 本仓库的 `.codex/hooks.json`（改 hook 后要重新 trust）。

`hook-commit` / `hook-push` 对 Claude 与 Codex 共用：失败时 **exit 2 + stderr**（两边都认）。

### Worktree / 旁路 WIP（硬）

- Hook 会从 shell 命令里的 `cd <path>` / `git -C <path>` **改绑**到实际提交/推送的 worktree，再算指纹与 `.mesa-agent-gates/<branch>/` 标记。
- Agent **禁止**用 `git stash` 清掉主仓/旁路分支的未提交改动，只为让 hook 放行另一 worktree 的 commit（见 `.cursor/rules/feature-branch-before-code.mdc`）。
- `git stash push` **不是** remote push；`hook-push` 会忽略含 `git stash` 的命令。
- 正确做法：本任务专用 worktree 内跑 `gate.sh scan|uat|check` 再 `cd` 该 worktree `git commit`。门禁仍看错树 → **停下来报**，不要 stash。
