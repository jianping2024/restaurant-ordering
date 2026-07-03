# ADR-001：离线优先策略

> **状态**：骨架（阶段 1）— 待阶段 5–6 定稿  
> **日期**：待定

## 背景

<!-- 餐馆现场网络不稳定时，点餐/结账/打印应如何降级？ -->

## 当前事实（初稿）

- **Web 应用**：依赖在线 Supabase，非离线优先 PWA
- **打印代理**：本地 Windows 进程，轮询云端 `print_jobs`；打印机连接在局域网侧
- **中长期**：见 [`../local-on-premise-deployment-plan.md`](../local-on-premise-deployment-plan.md)

## 决策

**待定。** 阶段 5 技术审计后确认是否采用离线优先、局部离线或维持在线为主。

## 后果

<!-- 待填写：对架构、同步冲突、UX 的影响 -->

## 相关 ADR

- [ADR-002 本地数据库](./ADR-002-local-database.md)
- [ADR-003 打印策略](./ADR-003-printing-strategy.md)
