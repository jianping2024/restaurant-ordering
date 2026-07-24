# ADR-001：离线 / 本地经营策略

> **状态**：已定稿  
> **日期**：2026-07-24  
> **落地步骤**：[`../local-only-rollout-steps.zh.md`](../local-only-rollout-steps.zh.md)

## 背景

餐馆公网不稳定时，店员开台、点单、收款、打票、关台不能瘫痪。顾客扫码可接受断公网不可用。

## 决策

采用 **门店纯本地权威**，不是浏览器 PWA 离线，也不是云↔本地自动切换：

1. 客户交付：店内主机跑 Web + 自托管 Supabase；营业数据只写本机库。  
2. 店员始终访问本机；无「故障切换」。  
3. 顾客扫码：域名指向本机；断公网扫不了可接受。  
4. 打印：现有 Windows print-agent 留在宿主机（= 桥），对接本机 API；不进 Docker。  
5. 不做 IndexedDB 双写订单、不做双库智能合并。

## 后果

- 每店需要常开主机与 Docker 运行环境。  
- 交付重心是 Compose 生产栈 + 安装/备份/升级；业务规则大体复用。  
- agent 须配置本机 URL，不再依赖平台云。  
- 研发可继续保留 `dev` / `stage` / `cloud`。

## 相关 ADR

- [ADR-002 本地数据库](./ADR-002-local-database.md)
- [ADR-003 打印策略](./ADR-003-printing-strategy.md)
