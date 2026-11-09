# 开台弹窗底栏钉住 · 业务场景测试

分支：`fix/open-table-modal-sticky-footer`  
UAT 基址：`http://localhost:3002`（feature，隔离 `.next-uat`）

## 1. 本次修改

- 开台弹窗「取消 / 确认开台」钉在弹窗底栏，不跟套餐列表滚走
- 两钮等宽铺满；确认开台保留桌台头像图标
- 文件：`WaiterBoardOpenTableSheet.tsx`、`WaiterBoardOpenTableForm.tsx`、`waiter-table-detail-ui.tsx`、`docs/agent-sole-index.zh.md`

## 2. 核心业务规则

1. 可滚区只有套餐/人数/合计；取消与确认只在 `Modal.footer`
2. 开台场景不用普通确认窗的右对齐窄钮，必须等宽 + 头像
3. 取消关窗；确认仍走原有开台提交（人数/套餐校验不变）

## 3. 详细测试场景

### 场景 1：滚套餐时底栏仍在

- **前置状态**：前台 `qiantai1`；空桌 A-06；套餐列表足够长或视口压矮
- **操作过程**：看板点 A-06 → 开台弹窗 → 把正文滚到底
- **预期结果**：取消/确认仍可见，位置不随滚动变化；两钮等宽；确认有头像
- **数据验证**：无写库
- **异常恢复**：不适用
- **结果**：【已验证】pass

### 场景 2：取消不写库

- **前置状态**：同上弹窗已开
- **操作过程**：点取消
- **预期结果**：弹窗关闭；A-06 仍空闲
- **数据验证**：看板仍显示 Livre
- **结果**：【已验证】pass

### 场景 3：确认开台

- **前置状态**：A-06 空闲；选 Buffet livre；成人 1
- **操作过程**：点确认开台
- **预期结果**：开台成功；看板 A-06 在席（A1 / €17.95）
- **数据验证**：board `sessionMeta` 有 session；随后未收款关台清理
- **结果**：【已验证】pass

### 场景 4：回归 — 其它确认弹窗

- **说明**：本次未改 `ModalConfirmActions`；价格规则等弹窗不在改动面
- **结果**：【不适用】未改共用窄钮确认行

## 4. 实际测试结果

- mesa-local-uat：stack-health / login / board — pass（`MESA_UAT_BASE=http://localhost:3002`）
- Chrome：实点 A-06 开台弹窗；DOM 断言 `inScroll=false`、`equalW`、`hasSvg`、`pinned` — pass
- 开台成功后 `close-table-session`（`left_unpaid`）清理 — pass

## 5. 风险与待确认

- 无未解产品歧义
- 外卖开台短路径同走 footer，本次未单独点外卖桌（逻辑同 Sheet footer 分支）— 【未验证】外卖桌 UI
