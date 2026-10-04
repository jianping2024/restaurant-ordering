# Agent delivery gates（Claude Code · Codex · Cursor 共用）

**唯一执行入口：** `bash scripts/agent-gates/gate.sh <cmd>`  
**策略正文也写在根目录 `AGENTS.md` → Checks**（Codex / Claude 都会读）。  
Cursor 的 `.cursor/rules/lint-build-before-commit.mdc` / `push-verification.mdc` 只是同一策略的镜像，改规则时以本目录 + `AGENTS.md` 为准。

## 门禁分工

| 时机 | 要求 | 命令 |
|---|---|---|
| **commit 前** | scoped **lint + typecheck**（不要 `next build`） | `gate.sh check` |
| **push 前** | scoped **production build** + 触及逻辑的 **targeted tests** | `gate.sh build` + `node --import tsx --test …` |
| 产品改动交付 | 清冗余 → UAT → 再 check → commit | `gate.sh scan` → `uat` → `check` |

### 作用面（按 diff）

- Web / `packages/*` → `npm run lint -w @mesa/web` + `npm run typecheck -w @mesa/web`（`tsconfig.typecheck.json`，排除 `*.test.ts`；与 `next build` 产品面一致，不拿测试夹具当 commit 硬门）
- Ops / `packages/*` → `npm run lint -w @mesa/ops` + `npm run typecheck -w @mesa/ops`（同上）
- Print-agent：**commit** → Docker `go vet`；**push** → Docker `go test` + Windows cross-build（见 `AGENTS.md`）

### 禁止

- commit 前跑整仓 `npm run build` 当硬门（太慢；留给 push）
- commit / push 跳过门禁指望 CI 拦
- 用 `next dev` / UAT 代替 lint、typecheck 或 production build

## 命令

```bash
bash scripts/agent-gates/gate.sh scan      # 校验 .mesa-agent-gates/<branch>/scan.md，记清冗余标记
bash scripts/agent-gates/gate.sh uat       # 校验 uat.md（## 测试项，无 fail）
bash scripts/agent-gates/gate.sh check     # lint + typecheck → commit 门禁
bash scripts/agent-gates/gate.sh build     # next build（独立 distDir）→ push/pack 门禁
bash scripts/agent-gates/gate.sh status
```

标记目录：`.mesa-agent-gates/<branch>/`（gitignore；按产品树指纹失效）。

## 钩子（强制执行同一脚本）

| 工具 | 配置 | 行为 |
|---|---|---|
| Claude Code | `.claude/settings.json` → `gate.sh hook-commit` / `hook-browser` | PreToolUse 拦 `git commit` / 浏览器测 |
| Codex | `.codex/hooks.json` → `gate.sh hook-commit` / `hook-push` | PreToolUse 拦 `git commit` / `git push` |
| Cursor | 无强制 hook；agent 须遵守 `AGENTS.md` + 镜像 rules | 人工/agent 自觉跑 `check` / `build` |

首次在 Codex 启用项目 hook 时，在 `/hooks` 里 **review + trust** 本仓库的 `.codex/hooks.json`（改 hook 后要重新 trust）。

`hook-commit` / `hook-push` 对 Claude 与 Codex 共用：失败时 **exit 2 + stderr**（两边都认）。
