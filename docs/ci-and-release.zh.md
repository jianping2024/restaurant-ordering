# CI、部署与 Print Agent 发布

## 现状（2026-05-26 起）

| 事件 | 工作流 | 作用 |
|------|--------|------|
| **push / PR → `main`** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `npm ci` → `lint` → `build`（与 Vercel 相同 build 命令） |
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

## 保证 Web 部署可靠

1. **不要跳过 CI**：merge / push 前看 [Actions → CI](https://github.com/jianping2024/restaurant-ordering/actions/workflows/ci.yml) 是否绿
2. **（推荐）GitHub 分支保护**：`Settings → Branches → main`  
   - Require status checks: **CI**  
   - 可选：Require PR（避免直接 push 坏代码到 main）
3. **Vercel**：Project → Settings → Git → 确认 Production Branch = `main`；Deployments 页查看失败日志（多为 env 缺失或 build 错误，CI 会复现同类问题）

---

## 给 Agent / 协作者的约定

完成 **tag + push** 或 **push main** 后：

1. 用 GitHub API 或 `scripts/wait-for-github-release.sh` **确认** release / CI 成功，再告诉用户「已可下载 / 已部署」
2. 发 agent 版时：**先改 VERSION，再 tag，再 push tag**；tag 名 `print-agent-v{VERSION}`
3. 仅 push `main` **不会**打 agent 安装包；需要另 push `print-agent-v*` tag

---

## 手动重跑

- Actions → 选工作流 → **Run workflow**（release 支持 `workflow_dispatch`，不上传 Release，只产 artifact）
