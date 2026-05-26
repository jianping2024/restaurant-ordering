# CI、部署与 Print Agent 发布

## 现状（2026-05-26 起）

| 事件 | 工作流 | 作用 |
|------|--------|------|
| **push 任意分支 / PR → `main`** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `npm ci` → `lint` → `build`；job 名 **`web`**（与 ruleset 一致） |
| **改 `apps/print-agent/**`** | [`.github/workflows/print-agent-ci.yml`](../.github/workflows/print-agent-ci.yml) | `go test` + Windows 交叉编译冒烟 |
| **push tag `print-agent-v*`** | [`.github/workflows/print-agent-release.yml`](../.github/workflows/print-agent-release.yml) | 校验 VERSION=tag → test → Windows 打包 → GitHub Release → **verify-release** 断言附件存在 |

**Vercel**：仍由 GitHub 连仓库后在 push `main` 时自动部署；`ci.yml` 失败会先在 GitHub 标红，便于在 Vercel 红之前发现。

---

## 发 Print Agent 版本（必做清单）

1. 改代码并更新 **`apps/print-agent/VERSION`**（如 `0.2.28`）
2. 提交并 push **`main`**，等 **CI** 与 **Print agent CI** 绿
3. 打 tag（**必须与 VERSION 一致**）：
   ```bash
   git tag print-agent-v0.2.28
   git push origin print-agent-v0.2.28
   ```
4. 等 **Print agent release** 工作流完成（含 **verify-release**  job）
5. 本地可选验证：
   ```bash
   chmod +x scripts/wait-for-github-release.sh
   ./scripts/wait-for-github-release.sh print-agent-v0.2.28
   ```
6. 打开 [GitHub Releases](https://github.com/jianping2024/restaurant-ordering/releases) 确认三个附件

**常见失败原因**

- tag 与 `VERSION` 不一致 → release 第一步即失败
- Go 测试失败 → 不会进入 Inno 打包
- 未 push tag 只 push 代码 → **不会**触发 Windows 安装包构建

---

## 推送到 main（分支保护 + 免手工 PR）

`main` 启用了 ruleset，**不能直接 `git push origin main`**，必须先过 **`web`** CI。

### 推荐：一条命令 push

```bash
git add -A && git commit -m "your message"
pnpm push                    # 或 ./scripts/push-to-main.sh
# 可选指定分支名：pnpm push feat/my-change
```

脚本会把当前 commit 推到 `ship/…` 或当前分支；配合下面两个 workflow：

| 工作流 | 作用 |
|--------|------|
| [`.github/workflows/open-pr.yml`](../.github/workflows/open-pr.yml) | push 非 main 分支 → **自动开 PR** |
| [`.github/workflows/automerge.yml`](../.github/workflows/automerge.yml) | PR 创建/更新后 → **开启 squash 自动合并**（CI 绿后合并） |

**一次性设置**（GitHub 仓库）：`Settings → General → Pull Requests` → 勾选 **Allow auto-merge**。  
之后 Agent / 本地只需 `commit` + `pnpm push`，无需手工点 Merge。

### 保证 Web 部署可靠

1. **不要跳过 CI**：等 [Actions → CI](https://github.com/jianping2024/restaurant-ordering/actions/workflows/ci.yml) 的 **`web`** job 变绿
2. **分支保护**：ruleset 要求 **`web`** status check（与 CI job 名一致）
3. **Vercel**：Production Branch = `main`；合并 PR 后自动部署

---

## 给 Agent / 协作者的约定

完成 **tag + push** 或 **push main** 后：

1. 用 GitHub API 或 `scripts/wait-for-github-release.sh` **确认** release / CI 成功，再告诉用户「已可下载 / 已部署」
2. 发 agent 版时：**先改 VERSION，再 tag，再 push tag**；tag 名 `print-agent-v{VERSION}`
3. 仅 push `main` **不会**打 agent 安装包；需要另 push `print-agent-v*` tag

---

## 手动重跑

- Actions → 选工作流 → **Run workflow**（release 支持 `workflow_dispatch`，不上传 Release，只产 artifact）
