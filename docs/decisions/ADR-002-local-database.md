# ADR-002：本地数据库策略

> **状态**：骨架（阶段 1）— 待阶段 5–6 定稿  
> **日期**：待定

## 背景

<!-- 是否在每个餐馆部署本地 Postgres？与 Supabase 云库如何分工？ -->

## 当前事实（初稿）

- **生产**：Supabase 托管 Postgres，RLS 多租户隔离
- **本地开发**：Docker Supabase 或链接云 stage 项目
- **迁移计划**：[`../supabase-to-postgres-migration.zh.md`](../supabase-to-postgres-migration.zh.md)（全平台自建 Postgres，中长期）

## 决策

**待定。** 当前以 Supabase 为唯一生产数据源；本地库仅限开发与私有化方案探索。

## 后果

<!-- 待填写：迁移成本、运维、租户隔离实现方式 -->

## 相关 ADR

- [ADR-001 离线优先](./ADR-001-offline-first.md)
- [ADR-003 打印策略](./ADR-003-printing-strategy.md)
