# 本次改动业务场景测试报告：Ops 本店套餐最短路径

## 1. 本次修改

- **内容：** Ops 餐厅详情 Pro 面板改为「套餐 + 功能包一次保存」；`basic` 时隐藏 Pro 功能包与期限；未到期 Pro 改 `basic` 须二次确认；API 对齐同一规则。
- **文件：** `RestaurantProPanel.tsx`；`PATCH …/restaurants/[id]`；`PUT …/pro-grants`；`replaceRestaurantProFeatureGrants`；`isProMembershipUnexpired`（shared）。
- **角色 / 页面：** Ops 管理员 · `/ops/restaurants/:id` 本店套餐。

## 2. 核心业务规则

1. `basic` 与 `pro` 互斥展示：工作态 `plan=basic` 不显示功能包与 Pro 期限。【本次新增】
2. 商业配置一次保存：一次「保存」写入 `plan`；若为 `pro` 同时写入功能包。【本次新增】
3. 未到期 Pro（`plan=pro` 且 `pro_valid_until` 未过或为空）→ `basic`：须 `confirmDowngradeFromActivePro`。【本次新增】
4. `plan≠pro` 时不可改功能包（PATCH 带 featureKeys 或 PUT pro-grants → 409）。【本次新增】
5. 降级**不删** `restaurant_pro_feature_grants` / `pro_valid_until`。【已实现】【本次确认】
6. 店内能否用功能仍只认 `isProEffective × grant`。【已实现】

## 3. 详细测试场景

### 场景 1：未到期 Pro 改 basic 无确认 → 拒绝

- **前置：** 店 `plan=pro`，`pro_valid_until` 在未来
- **操作：** Ops `PATCH` `{ plan: "basic" }`（无确认标记）
- **预期：** 409 `confirm_downgrade_from_active_pro_required`；库仍为 pro
- **标签：** 【已验证】

### 场景 2：未到期 Pro 改 basic 有确认 → 成功且保留 grant

- **前置：** 同场景 1，且已有功能包行
- **操作：** `PATCH` `{ plan: "basic", confirmDowngradeFromActivePro: true }`
- **预期：** 200；`plan=basic`；grant 行数不变
- **标签：** 【已验证】

### 场景 3：basic 下改功能包 → 拒绝

- **前置：** `plan=basic`
- **操作：** `PUT …/pro-grants` 改勾选
- **预期：** 409 `plan_not_pro`
- **标签：** 【已验证】

### 场景 4：basic 页面不显示 Pro 区

- **前置：** 店 `plan=basic`
- **操作：** 浏览器打开餐厅详情
- **预期：** 有「本店套餐」与一个「保存」；无「本店 Pro 功能包」「Pro 期限」
- **标签：** 【已验证】 / 【未验证】见实际结果

### 场景 5：选 pro 后出现功能包；一次保存

- **前置：** 页面上选 pro
- **操作：** 勾选功能 → 点一次「保存」
- **预期：** 保存成功；库 `plan=pro` 且 grants 更新；无第二颗「保存功能包」
- **标签：** 【已验证】 / 【未验证】见实际结果

### 场景 6：回归 — 店内判权

- **前置：** 降为 basic 后仍有 grant 行
- **预期：** 店内 Pro 功能仍不可用（`isProEffective` 失败）
- **标签：** 【已验证】单元；店内 UI 【未验证】（本轮聚焦 Ops）

## 4. 实际测试结果

| 场景 | 结果 | 标签 |
|---|---|---|
| 1 无确认降级 | 409 + 文案 | 【已验证】 |
| 2 确认降级保留 grant | 200；plan=basic；grant count=4 | 【已验证】 |
| 3 basic 改 grants | 409 plan_not_pro | 【已验证】 |
| 4 basic UI 隐藏 | 选/保存 basic 后无功能包、无 Pro 期限；仅一个「保存」 | 【已验证】 |
| 5 pro 显示 + 一保存 | 选 pro 出现功能包与期限；页面仅「保存」无「保存功能包」 | 【已验证】 |
| 6 判权 | `isProMembershipUnexpired` / `isProEffective` 单元 | 【已验证】单元 |
| UI 降级弹窗 | 未到期改 basic → 弹窗；取消后库仍 pro；确认后 basic 且 grant=4 | 【已验证】 |

## 5. 风险与待确认

- 改/延 Pro 期限仍会把店写成 pro（既有旁路，本轮未收）。
- 本轮未做店主端锁定 UI 全路径回归。
