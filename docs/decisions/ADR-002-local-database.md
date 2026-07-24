# ADR-002：本地数据库策略

> **状态**：已定稿  
> **日期**：2026-07-24  
> **落地步骤**：[`../local-only-rollout-steps.zh.md`](../local-only-rollout-steps.zh.md)

## 背景

客户交付若营业仍写云库，断公网即停业。需明确店内数据权威。

## 决策

1. **客户生产权威**：店内 Docker 中的自托管 Supabase（Postgres + Auth + Realtime + Storage）。  
2. **不做**「云主库 + 本地热备可写」双权威。  
3. 单机默认服务一家餐厅；保留 `restaurant_id` / RLS，不因本地化削弱隔离模型。  
4. 研发：本地 Docker Supabase 或云 stage/cloud 仅用于开发与验证，不是客户营业路径。  
5. 全平台自建 Postgres 替换 Supabase（另文）与本 ADR 正交，不阻塞门店本地交付。

## 后果

- 需固定版本 Compose、每店独立密钥、可备份可升级的数据目录。  
- 远程灾备：**每日**将本机备份上传至现有 **cloud 环境**；cloud 不作营业写路径。见 [`../local-only-rollout-steps.zh.md`](../local-only-rollout-steps.zh.md) §2.5。  
- 远程报表/多店聚合若以后需要，只能做只读同步副本，不能反客为主写回营业权威。

## 相关 ADR

- [ADR-001 离线 / 本地经营](./ADR-001-offline-first.md)
- [ADR-003 打印策略](./ADR-003-printing-strategy.md)
