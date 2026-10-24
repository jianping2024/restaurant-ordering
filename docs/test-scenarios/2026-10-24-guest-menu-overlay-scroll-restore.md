# 本次改动业务场景测试报告 — 关购物车等遮罩后点餐滚动位置保持

日期：2026-10-24  
分支：`fix/guest-menu-overlay-scroll-restore`  
UAT 基址：`http://127.0.0.1:3002`（功能分支，非 `:3000`）

## 1. 本次修改

- **内容：** 打开点餐遮罩时记下菜单滚动位置并冻住；关闭后写回。唯一入口 `lockBodyScroll`。
- **文件：** `apps/web/src/lib/body-scroll-lock.ts`、单测、`docs/agent-sole-index.zh.md`
- **角色 / 页面：** 顾客点餐页（Washoku Sushi 店招整页滚动）
- **流程：** 滑到非顶部 → 开遮罩 → 关 → 位置不变

## 2. 核心业务规则

1. 【本次新增】关遮罩后，点餐竖向位置与打开前一致。
2. 【已实现】只有一套锁：`useBodyScrollLock` → `lockBodyScroll`；菜单容器 `MENU_SCROLLPORT_SELECTOR`。
3. 【已实现】嵌套遮罩全部关掉后才恢复（单测覆盖）。
4. 【设计建议】左侧分类轨小范围滚动不在本次选择器内。

## 3. 详细测试场景

### 场景 1：有店招 — 关购物车位置不变

- **前置状态：** `lucky-tea-mulcs62n` 桌 100 点餐页；店招开启
- **操作过程：** 滑到 `scrollTop=520` → 点「Ver carrinho」→ ✕ 关闭
- **预期结果：** 关闭后仍为 520
- **数据验证：** 无服务端写入
- **异常恢复：** 打开期间把 `scrollTop` 改成 999，关闭后仍回到 520

### 场景 2：关菜品详情位置不变

- **前置状态：** 同页，滑到 680
- **操作过程：** 打开详情 → 关闭
- **预期结果：** 仍为 680；打开时容器 `overflow: hidden`
- **数据验证：** 无服务端写入

### 场景 3：购物车内清空确认（嵌套锁）

- **前置状态：** 需购物车有菜才能点「清空」
- **操作过程：** （本桌未开 buffet，加菜受阻，UI 未跑通嵌套）
- **预期结果：** 嵌套锁一次冻住、最后一次解锁才恢复
- **数据验证：** 单测 `nested locks freeze scrollports once…` 【已验证】；UI 清空路径 【未验证】

### 场景 4：无店招双栏（右侧目录滚动）

- **前置状态：** 无店招时右侧 `[data-mesa-menu-catalog-pane]` 滚动
- **操作过程：** —
- **预期结果：** 选择器已含 catalog pane；与 storefront 同一恢复逻辑
- **数据验证：** 单测用 catalog 元素 【已验证】；本机无店招 UI 【未验证】

### 场景 5：回归 — 开遮罩时冻住背景

- **前置状态：** 滑到中部后开购物车
- **操作过程：** 观察打开时容器 `style.overflow === 'hidden'`；关闭后位置还原
- **预期结果：** 冻住 + 还原（场景 1 已覆盖）

## 4. 实际测试结果

| 项 | 结果 | 标签 |
|---|---|---|
| `mesa-local-uat` stack-health（web+supabase，ops soft） | pass | 【已验证】 |
| owner login luckytea | pass | 【已验证】 |
| 客人菜单 HTTP 200 | pass | 【已验证】 |
| 场景 1 关购物车保位 | pass（520→520） | 【已验证】 |
| 场景 2 关详情保位 | pass（680→680） | 【已验证】 |
| 场景 3 嵌套清空 UI | — | 【未验证】（桌未开 buffet；单测 pass） |
| 场景 4 无店招 UI | — | 【未验证】（单测 catalog pass） |
| 场景 5 打开时 overflow hidden | pass | 【已验证】 |
| `body-scroll-lock` 单测 6 例 | pass | 【已验证】 |

## 5. 风险与待确认

- 程序仍可改 `scrollTop`，靠解锁写回打开前位置；真人手指滚动靠 `overflow: hidden` 挡住。
- 左侧分类轨保位若以后要做，扩展同一选择器，勿在 Cart 旁路再写。
