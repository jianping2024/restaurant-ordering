# CI、部署与 Print Agent 发布

## 现状（2026-05-26 起）

| 事件 | 工作流 / 工具 | 作用 |
|------|----------------|------|
| **PR → `main`（必过）** | **Vercel** Preview 部署 | ruleset 必过检查名：**`Vercel`** |
| **`pnpm push`** | [scripts/push-to-main.sh](../scripts/push-to-main.sh) | 自动提交并推 `main`（Vercel Production 部署） |
| **push / PR → `main`（可选）** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `lint` + `build`；不参与 merge 门禁 |
| **改 `apps/print-agent/**` 推 main** | [`.github/workflows/print-agent-ci.yml`](../.github/workflows/print-agent-ci.yml) | **`go test` + vet + 交叉编译**（发 tag 前应先绿） |
| **push tag `print-agent-v*`** | [`.github/workflows/print-agent-release.yml`](../.github/workflows/print-agent-release.yml) | 先 **test-linux**，再 Windows 安装包 + GitHub Release |

**Production 部署**：Vercel 在 merge `main` 后自动部署。

---

## Ruleset（merge 前必过 Vercel）

1. **Settings → Rules → Rulesets → statusCheckBeforeMerge → Edit**
2. **Enforcement status**：Active
3. **Target**：`main`
4. **Required status checks**：只加 **`Vercel`**（与 PR Checks 里绿色项名称一致；不要加 `web`）
5. Save

PR 上 Vercel Preview 变绿 → automerge 可合进 `main` → Vercel Production 部署。

---

## 推送到 main（`pnpm push`）

`main` 不能直接 `git push`；用：

```bash
pnpm push
```

会自动：`git add -A` → 提交 → **`git push origin main`**。

若本次提交改动了 **`apps/print-agent/`**（相对上一个 `print-agent-v*` tag），且 **`VERSION` 已递增**、远程尚无对应 tag，会再自动：

1. `go test` + `go vet`（同 CI）
2. `git tag print-agent-v{VERSION}` && `git push origin` 该 tag → 触发 Windows 安装包构建

跳过自动打 tag：`PUSH_SKIP_PRINT_AGENT_TAG=1 pnpm push`

若改了 agent 代码但 **没 bump `VERSION`**，脚本会报错并提示先改 `apps/print-agent/VERSION`。

若 GitHub ruleset 禁止直推 `main`，需暂时关闭 ruleset，或改用手动 PR。

---

## 发 Print Agent 版本

**原则**：改 `escpos.go` / 路由等业务逻辑 ≠ 改打包脚本；打包路径固定（Inno + `dist/`）。失败多半是 **没跑测试就 tag**，或 **workflow YAML 写坏**（曾把 `go test` 和 `choco install` 写在同一 step 的两个 `run:` 里，导致测试被跳过）。

### 发版前（本地，推荐）

```bash
./scripts/check-print-agent.sh
# 或一步：改 VERSION 后
./scripts/tag-print-agent.sh 0.2.31
git push origin main   # 若 VERSION 有新提交
git push origin print-agent-v0.2.31
```

### 发版步骤

1. 改 **`apps/print-agent/VERSION`**（与将要打的 tag 一致）
2. 在 **`apps/print-agent/RELEASE_NOTES.md`** 增加对应 `## X.Y.Z` 版本说明（打 tag 前必填；`tag-print-agent.sh` 会校验）
3. **`pnpm push`**（或 merge）— 确认 **Print agent CI** 在 main 上为绿
4. **`./scripts/check-print-agent.sh`**（与 CI 相同：`go test` + `go vet`）
5. `git tag print-agent-vX.Y.Z && git push origin print-agent-vX.Y.Z`
6. 等 **Print agent release** 全绿（`test-linux` → Windows 打包 → `verify-release`）
7. 在 [Releases](https://github.com/jianping2024/restaurant-ordering/releases) 确认有 **`MesaPrintAgent-Setup-amd64.exe`** 且 Release 正文含版本说明
8. 可选：`./scripts/wait-for-github-release.sh print-agent-vX.Y.Z`
9. 补写已发布版本的说明：`./scripts/patch-print-agent-release-body.sh X.Y.Z`（需 `GH_TOKEN`）

### 以后如何避免「业务改了却打包挂」

| 层级 | 做什么 |
|------|--------|
| **推 main** | 改 `apps/print-agent/**` 会跑 **print-agent-ci**（含 `go test`） |
| **打 tag** | **print-agent-release** 先跑 **test-linux**，失败则 **不会** 打 Windows 包 |
| **本地** | tag 前跑 `./scripts/check-print-agent.sh` |
| **不要改** | `print-agent-release.yml` 里 Inno/路径除非真要改安装方式；业务只改 `apps/print-agent/*.go` |
| **测试写法** | 小票标题/标签用 **ASCII 英文**（`receiptTicketLabels`）；不要用 `Pré-conta` 等重音字测热敏输出 |

---

## 给 Agent / 协作者

- **Web 部署**：merge 前看 PR 上 **Vercel** 是否绿；merge 后在 Vercel 看 Production。
- **不要**再依赖 GitHub Actions **`web`** 作为 merge 门禁。
- **Print agent**：必须 push `print-agent-v*` tag 才会打安装包。
