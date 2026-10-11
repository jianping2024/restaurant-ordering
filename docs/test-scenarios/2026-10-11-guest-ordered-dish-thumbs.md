# 本次改动业务场景测试报告：顾客「已点菜品」小图

日期：2026-10-11  
分支：`fix/guest-ordered-dish-thumbs`  
UAT 基址：`http://localhost:3002`（功能分支，隔离 distDir `.next-uat`）

## 1. 本次修改

顾客菜单「已点菜品」列表不再把下单时的 emoji 拼进菜名文字。  
每一行左边用与同桌气泡同一套小图：当前菜单有照片显示照片，没有照片显示这道菜的 emoji（先看菜单，菜单找不到再用订单行上的 emoji）。  
菜名文字只保留名字和份数（普通菜 `× n`，自助餐 `· A-C`）。

涉及文件：

- `PeerFloatDishThumb.tsx`（新，同桌气泡与已点共用）
- `CustomerMenuPeerFloats.tsx`、`CustomerOrderedItemsList.tsx`、`OrderedDrawer.tsx`
- `MenuOrderingController.tsx`、`sushi/SushiMenuPage.tsx`（传入当前菜单）
- `customer-submitted-order-display.ts`、`order-list-display.ts`（删掉 `formatOrderItemListLabel`）
- 对应单测与 `AGENTS.md` 一句约定

角色 / 页面：顾客手机菜单「已点菜品」抽屉（经典与寿司菜单同一抽屉）。

## 2. 核心业务规则

1. 已点行的图只走 `resolvePeerFloatThumb` + `PeerFloatDishThumb`，不另写第二套取图。
2. 已点行文字只走 `formatStaffBuffetLineLabel`（无行首 emoji）。
3. 自助餐行 id 不是菜品 id 时，对不上菜单照片 → 用订单行 emoji。
4. 菜已从菜单删除 → 用订单行 emoji。
5. 份数、批次时间、厨房进度、底部「继续点餐 / 查看账单」不变。
6. 同桌气泡仍用同一小图组件，行为不变。

## 3. 详细测试场景

### 场景 1：有照片的菜在已点里显示照片

- **前置状态**：白云 `restaurant-mohnrib5` 桌 A-03 已开台；菜单上「可乐」有照片；本机 web `:3002` 为功能分支。
- **操作过程**：员工开台 → 顾客端 API 下单可乐 + 中水 → 浏览器打开该桌菜单 → 点「查看已点」。
- **预期结果**：可乐行 `data-peer-float-thumb=photo`，菜名文字为 `可乐 × 1`（不含 emoji）；中水无照片则为 emoji 💧，文字 `中水 × 1`。
- **数据验证**：DOM 取图类型与 label；可乐图片 URL 来自本机菜单存储。
- **异常恢复**：不适用。
- **结果**：【已验证】pass

### 场景 2：自助餐行无菜单照片时显示订单 emoji

- **前置状态**：同场景 1，开台写入 Buffet livre。
- **操作过程**：打开已点列表查看自助餐行。
- **预期结果**：小图为 emoji 🍽️；文字 `Buffet livre · A2`（无人数字段为 0 的儿童段省略）；文字不含 emoji。
- **数据验证**：DOM `kind=emoji`，label 无 🍽️。
- **异常恢复**：不适用。
- **结果**：【已验证】pass

### 场景 3：菜单照片文件本身是纯色块

- **前置状态**：本机「可乐」菜单照片文件为纯绿色 JPEG（3887 bytes，640×480）。
- **操作过程**：已点列表显示可乐照片格。
- **预期结果**：仍走照片路径（不是 emoji）；画面上看到绿块是菜单数据，不是列表画错成别的图。
- **数据验证**：`curl` 下载照片确认内容；DOM `kind=photo`。
- **异常恢复**：不适用。
- **结果**：【已验证】pass（数据问题，非本次回归）

### 场景 4：单元测试 — 有菜单照片时文字不含 emoji

- **前置状态**：`customer-submitted-order-display.test.ts`。
- **操作过程**：`node --import tsx --test` 跑该文件与 `order-list-display` / `sushi-peer-float-display`。
- **预期结果**：全部通过；有 `image_url` 时 thumb 用照片、label 无 emoji；无菜单时回落订单 emoji。
- **数据验证**：26 个用例 pass。
- **异常恢复**：不适用。
- **结果**：【已验证】pass

### 场景 5：多人并发改菜单照片

- **前置状态**：顾客已打开已点抽屉期间，店员改某菜照片。
- **操作过程**：未在本轮实测（需双端同时操作）。
- **预期结果**：【设计建议】下次打开抽屉或菜单数据刷新后，用最新菜单照片；不要求抽屉打开中实时改图。
- **结果**：【未验证】

### 场景 6：店员桌台「已点菜品」列表

- **前置状态**：店员桌台详情也有「已点菜品」文案。
- **操作过程**：本次未改店员列表（仍走原有 label，不含本抽屉小图）。
- **预期结果**：店员侧不变。
- **结果**：【未验证】（范围外，非回归必测）

## 4. 实际测试结果

| 项 | 结果 | 说明 |
|---|---|---|
| `mesa-local-uat` stack-health | pass | web `:3002` ready；ops softMissing |
| owner 登录 `baiyun@gmail.com` | pass | jar baiyun |
| 开台 A-03 + buffet | pass | session 已建 |
| 顾客 append 可乐+中水 | pass | HTTP 200 |
| 浏览器已点小图 DOM | pass | 照片 / emoji / 无 emoji 文字 |
| 关台清理 | pass | session `closed`（`no_session` 再关时确认已关） |
| 聚焦单测 | pass | 26/26 |
| 清冗余 `gate.sh scan` | pass | 指纹已记 |
| Realtime 双端 | skip | 本次仅为展示取图，无状态同步面 |

## 5. 风险与待确认

- 菜单照片若是占位纯色图，已点会如实显示该图；要好看需在菜单里换真照片。
- 店员桌台已点列表未纳入本次改造。
- 抽屉打开期间菜单改图是否即时刷新：【未验证】，当前实现随 `menuItems` prop 更新。
