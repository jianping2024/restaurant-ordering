# 本次改动业务场景测试报告 — 桌位二维码贴纸加店名

日期：2026-11-27  
分支：`feat/table-qr-store-name`  
UAT base：`http://localhost:3002`

## 1. 本次修改

- 贴纸唯一内容形状改为 `{ displayName, restaurantName, qrDataUrl }`
- 铝片仍 50×55mm；二维码约 37mm；底部画餐厅名
- 预览 / 打印 / ZIP 共用 `composeTableQrPng`
- 弹窗「打开点餐页」仍只作电脑测试链接，不进贴纸

## 2. 核心业务规则

1. 贴纸面 = 桌号 → QR → 店名（【本次新增】店名）
2. 物理比例锁 50∶55；QR URL 仍按 `table_id`（【已实现】）
3. 「打开点餐页」不进 PNG（【已实现】）

## 3. 详细测试场景

### 场景 1：预览贴纸含店名

- **前置：** 店主已登录白云 `restaurant-mohnrib5`
- **操作：** Mesas → 点 A-01 二维码缩略 → 看预览图
- **预期：** 上桌号 A-01；中 QR；下「白云自助火锅」；自然尺寸 800×880
- **数据验证：** 弹窗外仍有「Abrir pedido」链接；链接文案不在 PNG 内
- **异常恢复：** 关开弹窗仍同图

### 场景 2：布局常量自洽

- **前置：** 跑 `table-qr-card-layout.test.ts`
- **操作：** node test
- **预期：** mm 合计 = 55；header+QR+footer+pad = height
- **标签：** 【已验证】

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 清冗余 scan | 【已验证】pass |
| stack-health / login | 【已验证】pass |
| 布局单测 | 【已验证】pass |
| 预览实点店名可见 | 【已验证】pass — 截图见贴纸含「白云自助火锅」 |
| lint+typecheck | 【已验证】pass |

## 5. 风险与待确认

- 列表缩略仍为裸 QR（非贴纸面）— 与改前一致
- 极长店名会缩到最小字号；过长仍可能略挤 — 单行拟合已覆盖
