# 本次改动业务场景测试报告 — 打印设置页搬迁

日期：2026-10-12  
分支：`fix/print-settings-page-move`  
UAT base：`http://localhost:3002`（功能分支，`MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

把「结账与账单」四开关（含快速关台）、打印语言、纸面与代理（分类分组 / 中文位图字号 / 代理凭证天数）从**功能管理**挪到设置 Tab「打印设置」（路径仍为 `/dashboard/settings/print-assistant`）。功能管理只留后厨、风味、冷却、寿司、操作日志。保存仍走 `PATCH /api/restaurant/features`，按字段分别要求 `settings.print_assistant.manage` / `settings.features.manage`。

涉及角色：店主（设置页）。页面：打印设置、功能管理。

## 2. 核心业务规则

1. 结账出票 / 纸面选项的**唯一编辑入口**是打印设置页上的 `RestaurantPrintSettingsSection`。
2. 「打印发票」与「快速关台」互斥：开一个关另一个（`applyBillingCheckoutModeExclusions`）。
3. 功能管理保存不得带上 billing 开关字段，避免覆盖打印页刚改的值。
4. 运行时门控（打不打预结、开台票、发票入口、关台结账按钮）不因搬家而改变。

## 3. 详细测试场景

### 场景 1：打印设置页能看到并保存搬过来的块

- **前置状态**：店主已登录；本机 web `:3002` 为功能分支。
- **操作过程**：打开 `/dashboard/settings/print-assistant`。
- **预期结果**：页顶有「结账与账单」四勾选、打印语言三选、纸面与代理三项；其下仍有设备/配对等原内容；Tab 文案为「打印设置」（葡语 UI 为「Impressao」）。
- **数据验证**：【已验证】浏览器快照见 Checkout e contas / Idioma / Papel e agente + Guardar；API `PATCH` 打印账单开关 200。
- **异常恢复**：不适用。

### 场景 2：功能管理页不再出现这些块

- **前置状态**：同上。
- **操作过程**：打开 `/dashboard/settings/features`。
- **预期结果**：无结账与账单、无打印语言、无纸面与代理；仍有后厨、风味、冷却、寿司、操作日志。
- **数据验证**：【已验证】`evaluate_script`：`hasCheckoutBilling/hasPrintLocale/hasPaperAgent=false`；headings = Fluxo de cozinha / Sabor / Refracao / Rodadas sushi / Registos。
- **异常恢复**：不适用。

### 场景 3：打印发票 ↔ 快速关台互斥（API）

- **前置状态**：店主 cookie jar。
- **操作过程**：`PATCH` 开 `bill_sync_to_fiscal` → 再开 `quick_table_close` → 再两者都关。
- **预期结果**：开发票时 quick=false；开 quick 时 invoice=false；恢复后均为 false。
- **数据验证**：【已验证】mesa-local-uat 响应 flags。
- **异常恢复**：恢复关状态写回成功。

### 场景 4：功能管理字段仍可单独保存

- **前置状态**：店主 cookie。
- **操作过程**：`PATCH` 仅 `{ flags: { kitchen_serve_to_table: false } }`。
- **预期结果**：200，不要求打印助手权限以外的额外字段。
- **数据验证**：【已验证】status 200。
- **异常恢复**：不适用。

### 场景 5：仅有打印助手权限、无功能管理权限时改纸面（权限拆分）

- **前置状态**：需非 owner、只勾 `settings.print_assistant.manage` 的员工账号。
- **预期结果**：可 PATCH billing/printLocale/纸面字段；PATCH 厨房/寿司应 403。
- **数据验证**：【未验证】本地 UAT 未准备仅打印权限账号；owner `*` 已覆盖可写路径。
- **异常恢复**：—

### 场景 6：楼面关台结账 / 发票入口运行时回归

- **前置状态**：开关组合变化后开台结账。
- **预期结果**：行为与搬家前一致（本改动仅搬 UI/权限门，不改运行时公式）。
- **数据验证**：【未验证】本次只验设置页与 PATCH；未开台走完整结账。
- **异常恢复**：—

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| stack-health（web+supabase，ops soft） | pass（ready） |
| owner login luckytea | pass |
| GET/PATCH features（打印开关、互斥、厨房） | pass |
| UI 打印设置页含搬迁块 + Tab「Impressao」 | pass |
| UI 功能管理无搬迁块 | pass |
| 仅打印权限账号 | 【未验证】 |
| 楼面结账运行时全路径 | 【未验证】 |

## 5. 风险与待确认

- 权限拆分对「只有打印助手、没有功能管理」的角色尚未用专用账号手测。
- 搬家不改变出票/关台逻辑；若线上有人书签「功能管理里改打印语言」，需知入口已变。
