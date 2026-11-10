# 2026-11-10 顾客按菜认票 · 份量加号立体浮雕

## 本次修改

- 内容：认票卡「+1 / +1/n / +1 成人 / +1 儿童」接 `buttonPressReliefSoftClass`；圆形「−」接 `buttonPressReliefCompactClass`；sole 面壳落在 `guest-claim-portion-chip.ts`（成人与儿童同一 chip，不得只改一侧）
- 文件：`guest-claim-portion-chip.ts`、`GuestClaimDishCard.tsx`、`docs/agent-sole-index.zh.md`、静态稿 `docs/design/mockups/2026-11-10-guest-claim-portion-chip-relief.static.html`
- 角色/页面：顾客账单 · 按菜认票（`GuestClaimPanel` / `GuestClaimDishCard`）
- UAT 基座：`http://localhost:3002`（feature 分支，`.next-uat`）

## 核心业务规则

1. 份量加号只有一种面壳：`GUEST_CLAIM_PORTION_CHIP_CLASS`（soft 浮雕）；自助成人/儿童与普通菜 `+1/+1/n` 共用；禁止卡片内手写 shadow / 扁平 `active:scale`
2. 圆形「−」只有一种面壳：`GUEST_CLAIM_PORTION_MINUS_CLASS`（compact 浮雕）
3. 认票数量逻辑不变；disabled（虚线）时无浮雕底板（`disabled:shadow-none`）

## 详细测试场景

### 场景 1：自助餐 +1 成人 / +1 儿童 同档 soft 浮雕且可加数量 【已验证】

- **前置状态**：feature web `:3002`；A-06 开台「UAT 第二套餐」成人2+儿童1（儿童侧开启）；顾客进账单选「按菜」
- **操作过程**：看到并排「+1 Adulto」「+1 Crianca」→ 各点一下
- **预期结果**：两钮同一 soft 浮雕 token；成人/儿童各 1；金额 €33.75；两颗「−」为 compact
- **数据验证**：DOM `hasSoft` 两侧均为 true；`hasFlatScale` false；儿童加满后 disabled 且 computed `box-shadow` 清零
- **异常恢复**：关台 left_unpaid 清理
- **结果**：【已验证】pass

### 场景 2：普通菜 +1 / +1/n 同档 soft 【设计契约】

- **前置**：同 sole `GUEST_CLAIM_PORTION_CHIP_CLASS`（`GuestClaimDishCard` menu 分支与 buffet 分支同一 className）
- **说明**：本桌只有自助行；普通菜与自助加号共用 sole 常量，无第二套面壳——【已实现】代码路径；本轮未另开普通菜桌实点——标【未验证】页面实点，契约已锁

### 场景 3：− 为 compact；加满后加号 disabled 无浮雕 【已验证】

- 见场景 1：两颗「−」`hasCompact=true`；「+1 Crianca」disabled + `disabled:shadow-none` + 实测 shadow 清零

### 场景 4：页脚 CTA 未改 【已验证】

- 底栏仍为「✏️ Escrever nome」+「← Voltar ao pedido」`Button` 形态；本轮未改页脚

### 不适用并说明

- 多用户并发抢席 / 结账写路径：本次只改按下浮雕面壳，无服务端规则变更
- 店员按菜池 CTA：已是 soft，不在本 diff

## 实际测试结果

| 项 | 结果 |
|---|---|
| 清冗余 `gate.sh scan` | pass |
| stack-health `:3002` | pass |
| UI 实点成人+儿童 soft / − compact | pass |
| 关台清理 | pass |

## 风险与待确认

- 五档 `+1/n` 并排时 soft 底板略增高：本轮未开普通菜桌实点五档；静态稿已示
