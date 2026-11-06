# 客户注册与优惠券 · 开发顺序（已定）

> **状态：已定顺序 · 2026-11-03**  
> **产品**：[`../product/customer-registration-coupons.zh.md`](../product/customer-registration-coupons.zh.md)  
> **总技术方案**：[`./customer-coupons-tech-plan.zh.md`](./customer-coupons-tech-plan.zh.md)  
> **库设计**：[`./customer-coupons-db-design.zh.md`](./customer-coupons-db-design.zh.md)  
> **均摊按份**：[`../product/even-per-seat-checkout.zh.md`](../product/even-per-seat-checkout.zh.md)

---

## 顺序（不要跳步碰收款）

| 步 | 名称 | 单独方案文档 | 交付物一句话 |
|---|---|---|---|
| **1** | 库表迁移 | [`./customer-program-phase-1-migration.zh.md`](./customer-program-phase-1-migration.zh.md) | 总闸列 + 顾客/会话/券等相关表落库；**不改收款 RPC、不上 API** |
| **2** | 顾客注册 / 登录 | （下一步出） | 注册登录登出、`me`；验登录不换游客 Realtime |
| **3** | 均摊按份呼叫 | 均摊定稿 | 锁桌、名单上服务器、按座位呼叫/代收；可不依赖券 |
| **4** | 发券与我的优惠券 | （其后出） | 活动/手动发券、顾客能看见券；**仍不核销** |
| **5** | 结账选券 + 收款核销 | （其后出） | 接 `confirm_bill_split_payment` 等；三种结账方式同一套认人 |
| **6** | 发信 | （其后出） | 找回密码、发券通知等 |
| **7** | UI 收口 | （其后出） | 入口、三语、体验 |

---

## 硬约束（全程）

1. 顾客**不进** Supabase Auth；会员 cookie 与员工会话隔离。  
2. 桌台 Realtime **永远** `createGuestClient`（anon）；登录不得替换（产品 §8.4 / 技术方案 §1.1）。  
3. 新顾客表：`RLS on，无 policy`，只走服务端 service_role。  
4. 均摊行为变更**不跟**优惠券总闸分两套路径。  
5. **第 5 步之前**禁止改收款金额语义 / 核销 RPC（第 1 步若加台账列，只加可空列，旧收款行为不变）。

---

## 当前进度

| 步 | 状态 |
|---|---|
| 1 迁移方案 | **待你确认本文 + phase-1 文档后开工** |
| 2–7 | 未出分步方案 |

确认第 1 步后：开专用分支做迁移 → 本机 `db push --local` → 再出第 2 步方案文档。
