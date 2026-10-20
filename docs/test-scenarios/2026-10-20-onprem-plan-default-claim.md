# 2026-10-20 · On-prem `/setup` plan 默认与认领写入

## 本次修改

- 迁移：`restaurants.plan` 默认改为 `basic`，约束保持 `basic|pro`
- 认领：`/api/setup/claim` 传入 Ops 的 `plan`；`applyOnPremClaim` / check-in 一律 `normalizeRestaurantPlan`
- 在 tip 本机库重导 `baseline_public.sql` + `baseline_covered_migrations.txt`（148=全部迁移，初装 pending=0）

涉及：本机装机认领、升级后迁移、云 Ops 安装码。

## 核心业务规则

1. 本机 `restaurants.plan` 只允许 `basic` 或 `pro`
2. 认领写入必须显式带合法 `plan`（缺省/旧 `free` → `basic`）
3. 云端安装码一经成功 claim 即消耗；本机落库失败后须 Ops 发新码

## 详细测试场景

### 场景 1：新装包认领（正常）

- **前置：** 含本迁移的 zip 初装完成；Ops 有 pending 安装码；`MESA_PLATFORM_LICENSE_URL` 指向云 Ops
- **操作：** `/setup` 填安装码 + 店主密码（Ops 地址可留空）→ 认领
- **预期：** 成功跳转登录；本机 `restaurants.plan` 为 `basic` 或 Ops 下发的 `pro`
- **数据：** `license-state/platform.json` 三字段齐全
- **结果：** 【未验证】店机待升包

### 场景 2：旧库已跑 pro_tier、DEFAULT 仍为 free

- **前置：** 店库约束已是 `basic|pro`，列默认仍是 `free`（本次事故形态）
- **操作：** 升级含 `20261020120000` 的包（或手改 DEFAULT）+ Ops 新码认领
- **预期：** 不再 `restaurants_plan_check`；认领成功
- **结果：** 【未验证】店机待做；代码+迁移已合本分支

### 场景 3：同一安装码在本机失败后重试

- **前置：** 云 claim 已成功、本机 insert 曾失败
- **操作：** 同一码再点认领
- **预期：** 云返回 `code_not_available`；须新码
- **结果：** 【已实现】见 `claimOnPremInstallation`；【未验证】本轮未再打店机

### 场景 4：回归 — check-in 写 plan

- **前置：** 已认领店
- **操作：** 授权 check-in
- **预期：** 回写 `plan` 经 `normalizeRestaurantPlan`，不会写入 `free`
- **结果：** 【已实现】代码路径；【未验证】店机 check-in

## 实际测试结果

| 项 | 标签 |
|----|------|
| `normalizeRestaurantPlan` 单测 | 【已验证】pass |
| 本机 `db push` 应用新迁移 | 【已验证】pass |
| tip 重导 baseline；covered=148；pending=0；plan DEFAULT basic | 【已验证】pass |
| 店机 `/setup` 端到端 | 【未验证】待打新包升级后测 |

## 风险与待确认

- 已失败认领的店：必须 Ops 新码；仅改 DEFAULT 不够
- 下次发行包必须含本迁移 + 新 web 镜像（claim 写 plan）
