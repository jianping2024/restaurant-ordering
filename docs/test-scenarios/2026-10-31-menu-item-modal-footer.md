# 本次改动业务场景测试报告 · 编辑/新增菜品弹窗脚钮钉底

日期：2026-10-31  
分支：`fix/menu-item-modal-footer`  
UAT 基址：`http://localhost:3004`（feature · `MESA_NEXT_DIST_DIR=.next-uat`）  
店：Washoku Sushi `lucky-tea-mulcs62n`（`luckytea@gmail.com`）

## 1. 本次修改

- **内容**：新增/编辑菜品弹窗的「取消」「保存修改/添加菜品」从可滚动表单末尾挪到 `Modal` 的 `footer`，与「批量生成动图」同一套钉底确认行（`ModalConfirmActions`）。动图处理中的等待文案也钉在底栏上方。
- **文件**：`apps/web/src/components/dashboard/MenuManager.tsx`
- **角色 / 页面**：店主 → 后台「菜单管理」→「菜品」→ 编辑 / 添加
- **流程**：打开长表单 → 滚动中间区 → 底栏按钮始终可见可点；取消不写库。表单字段与保存 API【未改】。

## 2. 核心业务规则（不变量）

1. 【本次新增】新增/编辑菜品弹窗的取消与确认**只**通过 `Modal.footer` + `ModalConfirmActions` 钉底，不进可滚动 `children`。
2. 【已实现】保存中 `busy` 禁用取消并给确认钮 loading；图/动图处理中 `confirmDisabled`。
3. 【已实现】短确认（如「确定删除」）不传 `footer`，确认行仍在滚动 children 内。
4. 【已实现】菜品字段校验、写库、动图编码路径【未改】。

## 3. 详细测试场景

### 场景 1：编辑长表单时脚钮常显（正常）

- **前置状态**：已登录店主；菜品列表筛选「饮料水」；点「0100 冰块加柠檬」→「编辑」。
- **操作过程**：打开「编辑菜品」；用脚本滚 `.modal-scroll` 到底；量保存钮相对视口位置。
- **预期结果**：取消/保存不在 scroll 内；`footerOutsideScroll=true`；滚 body 后保存钮 top 不变且仍可见。
- **数据验证**：未点保存。
- **异常恢复**：可点取消关闭。

### 场景 2：取消关闭不写库（异常恢复）

- **前置状态**：编辑弹窗已开。
- **操作过程**：点「取消」。
- **预期结果**：弹窗关闭；列表仍显示「0100 冰块加柠檬」。
- **数据验证**：无保存请求（本轮未改字段）。
- **异常恢复**：可再次点编辑打开。

### 场景 3：新增菜品同样钉底（正常）

- **前置状态**：菜品列表。
- **操作过程**：点「+ 添加菜品」。
- **预期结果**：标题「添加菜品」；取消/添加菜品在 footer 外（`footerOutsideScroll=true`）。
- **数据验证**：未提交新增。
- **异常恢复**：点取消关闭。

### 场景 4：短删除确认无 footer 回归（回归）

- **前置状态**：列表有删除。
- **操作过程**：点「0100」行「删除」；量确认钮位置。
- **预期结果**：标题「确定删除」；`confirmInScroll=true`；`footerPropOnConfirm=false`。
- **数据验证**：点取消，菜仍在列表。
- **异常恢复**：关闭后列表不变。

### 场景 5：多用户并发改同菜（不适用说明）

- **不适用原因**：本次仅布局钉底，不改写库冲突处理。【未验证】业务并发。

## 4. 实际测试结果

| 场景 | 结果 | 标签 |
|---|---|---|
| 1 编辑脚钮常显 | pass：`footerOutsideScroll=true`，`canScroll=true`，`saveTopStable=true`（top 1078.5） | 【已验证】 |
| 2 取消不写库 | pass：关闭后列表仍有 0100 | 【已验证】 |
| 3 新增钉底 | pass：`footerOutsideScroll=true`，标题「添加菜品」 | 【已验证】 |
| 4 短删除回归 | pass：`confirmInScroll=true`，`footerPropOnConfirm=false`；取消未删 | 【已验证】 |
| 5 并发 | — | 【未验证】不适用 |

API：`mesa-local-uat` `stack-health` + `login`（luckytea）+ `GET /api/health/live` exit=0。【已验证】

## 5. 风险与待确认

- 其它仍把手写确认行放在 children 末尾的长 Modal（如桌台分组）不在本次范围，长内容时仍可能滚走按钮。
- 保存中取消改为与 `ModalConfirmActions.busy` 一致禁用；比改前略严，属设计对齐。
