# 本次改动业务场景测试报告 — 店员继续点餐侧栏菜品可滚

日期：2026-10-24  
分支：`fix/staff-ordering-scroll-lock`  
UAT 基址：`http://127.0.0.1:3003`（功能分支，非 `:3000`）

## 1. 本次修改

- **内容：** 滚动锁冻菜单列表时，跳过已在打开的对话框（`role=dialog` + `aria-modal=true`）里的列表。店员「继续点餐」侧栏内的菜品列表不再被冻死。
- **文件：** `body-scroll-lock.ts` / `.test.ts`、`docs/agent-sole-index.zh.md`
- **角色 / 页面：** 店员楼面 → 桌详情 → 继续点餐
- **流程：** 打开侧栏 → 菜品区可竖滑；背后楼面仍不可滚

## 2. 核心业务规则

1. 【本次新增】对话框内的菜单列表容器不上锁冻滚动。
2. 【已实现】遮罩背后的店招/目录列表仍冻住，关遮罩后恢复位置。
3. 【已实现】唯一跳过规则：`MENU_SCROLLPORT_LOCK_SKIP_CLOSEST`。

## 3. 详细测试场景

### 场景 1：店员继续点餐 — 菜品区可滚

- **前置状态：** 白云 A-03 开台；前台登录
- **操作过程：** 点「Continuar pedido」→ 量侧栏内 catalog 的 inline overflow 并竖滑
- **预期结果：** body/html 为 hidden（背后锁住）；catalog **不是** inline `overflow:hidden`；scrollTop 可增加
- **数据验证：** 无服务端写入

### 场景 2：单测 — 对话框内不冻、背后冻

- **前置状态：** 单测 stub 两个 catalog
- **操作过程：** `lockBodyScroll`
- **预期结果：** 背后 frozen；对话框内 overflow 仍空

### 场景 3：回归 — 客人店招关购物车仍保位（单测）

- **前置状态：** storefront scrollport stub
- **操作过程：** lock → 改 scrollTop → unlock
- **预期结果：** 写回打开前位置

### 场景 4：栈健康 + 登录

- **前置状态：** 本地 web + supabase
- **操作过程：** stack-health、staff login
- **预期结果：** ready；login ok

## 4. 实际测试结果

| 项 | 结果 | 标签 |
|---|---|---|
| 清冗余（唯一 skip 常量） | `gate.sh scan` pass | 【已验证】 |
| body-scroll-lock 单测 7 例 | pass | 【已验证】 |
| 场景 1 UI 继续点餐可滚 | body hidden；catalog inline 空；0→220 | 【已验证】 |
| 场景 2/3 单测 | pass | 【已验证】 |
| 场景 4 stack-health / staff login | pass | 【已验证】 |

## 5. 风险与待确认

- 其它带 `role=dialog aria-modal=true` 且内含菜单列表的面板也会跳过冻结（符合「面板内要能滚」）。
- 客人底部抽屉不是 dialog，背后目录仍会冻（既有行为）。
