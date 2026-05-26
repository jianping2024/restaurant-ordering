# CI、部署与 Print Agent 发布

## 现状（2026-05-26 起）

| 事件 | 工作流 / 工具 | 作用 |
|------|----------------|------|
| **PR → `main`（必过）** | **Vercel** Preview 部署 | ruleset 必过检查名：**`Vercel`** |
| **`pnpm push`** | [scripts/push-to-main.sh](../scripts/push-to-main.sh) | 自动提交并推 `main`（Vercel Production 部署） |
| **push / PR → `main`（可选）** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `lint` + `build`；不参与 merge 门禁 |
| **改 `apps/print-agent/**`** | [`.github/workflows/print-agent-ci.yml`](../.github/workflows/print-agent-ci.yml) | Go vet + 交叉编译 |
| **push tag `print-agent-v*`** | [`.github/workflows/print-agent-release.yml`](../.github/workflows/print-agent-release.yml) | Windows 安装包 + GitHub Release |

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

若 GitHub ruleset 禁止直推 `main`，需暂时关闭 ruleset，或改用手动 PR。

---

## 发 Print Agent 版本

1. 改 **`apps/print-agent/VERSION`**
2. `pnpm push` 或 merge 到 `main`
3. `git tag print-agent-v0.2.28 && git push origin print-agent-v0.2.28`
4. 等 **Print agent release** 完成（含 verify-release）
5. 可选：`./scripts/wait-for-github-release.sh print-agent-v0.2.28`

---

## 给 Agent / 协作者

- **Web 部署**：merge 前看 PR 上 **Vercel** 是否绿；merge 后在 Vercel 看 Production。
- **不要**再依赖 GitHub Actions **`web`** 作为 merge 门禁。
- **Print agent**：必须 push `print-agent-v*` tag 才会打安装包。
