# SaaS 云平台选型：Vercel 替代方案与性价比

> 状态：调研稿（2026-06-25）  
> 关联：[`supabase-to-postgres-migration.zh.md`](./supabase-to-postgres-migration.zh.md) §4.4（轮询成本模型）  
> 前提：**Postgres-only** 全平台迁移后，SaaS 跑 Next.js（`@mesa/web` + `@mesa/ops`）+ 托管 PostgreSQL；打印代理仍 **不上云**。

## 1. 选型要先对齐的约束

| 约束 | 说明 |
|------|------|
| **双应用** | 租户站 `apps/web` + 运营站 `apps/ops`（独立域名、Cookie 隔离） |
| **Cron** | `nightly-close-sessions` 等（现 `apps/web/vercel.json`） |
| **实时** | SaaS 第一期计划 **轻量 `/poll`**（§4.4）；长期可用 SSE / Redis |
| **数据库** | 纯 Postgres（Neon / Render PG / 同机 PG 等） |
| **文件** | 菜单图：S3 / R2 / Blob（与计算平台可分离） |
| **市场** | 葡萄牙餐厅为主 → **欧盟区延迟** 比全球边缘更重要 |
| **并行路线** | Windows 私有化也会用 Docker + Postgres → 与 **Hetzner/Coolify** 技能可复用 |

**计费口径**（与 §4.4 一致）：「店」= 活跃租户餐厅；轮询成本 ∝ **营业中的员工 tab 数**，与扫码顾客数弱相关。

---

## 2. 候选平台总览

| 平台 | 类型 | 月费形状 | 与 Mesa 匹配度 | 一句话 |
|------|------|----------|----------------|--------|
| **Vercel + Neon** | Serverless + 外置 DB | $20 席位 + 按量 | ⭐⭐⭐⭐ 已落地 | DX 最好；轮询会把钱打在 Function 上 |
| **Cloudflare Workers + Neon** | 边缘计算 + Hyperdrive | $5 起 + 按请求 | ⭐⭐⭐ 需 OpenNext | **按请求极便宜、流量免费**；适配与调试成本高 |
| **Render** | 长驻 Web Service + 托管 PG | **固定月费/服务** | ⭐⭐⭐⭐ | 可改 SSE 降轮询；价可预测；欧盟区 |
| **Railway** | 用量计费 PaaS | 按 CPU/RAM 秒 | ⭐⭐⭐⭐ Monorepo 友好 | 接近 Vercel 体验；价格随负载浮动 |
| **Fly.io** | 全球微型 VM | 按秒 + 卷 | ⭐⭐⭐ | 出口流量便宜；运维多于 Render |
| **Hetzner + Coolify** | 自管 VPS + PaaS UI | **€4～15 固定** | ⭐⭐⭐⭐ 长期最便宜 | 与私有化栈一致；你们要当运维 |
| **DigitalOcean App Platform** | 托管 PaaS | 固定档位 | ⭐⭐⭐ | Render 同类；价略高 |

未列入主推荐：**AWS/GCP 裸机**（合规/大客户再上）、**Supabase 继续托管**（与 Postgres-only 决策冲突）。

---

## 3. 按规模粗算月费（USD，2026-06 公开价）

假设：**B 轻量轮询**（§4.4），每家店 3 tab、3s 间隔、日营业 10h。  
仅为 **数量级对比**，实际以账单为准；链接：[Vercel](https://vercel.com/pricing)、[Neon](https://neon.com/pricing)、[Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/)、[Render](https://render.com/pricing)、[Railway](https://railway.com/pricing)、[Fly.io](https://fly.io/docs/about/pricing/)、[Hetzner](https://www.hetzner.com/cloud)。

### 3.1 约 30 家活跃店

| 方案 | 计算 | 粗算月费 | 备注 |
|------|------|----------|------|
| **Vercel Pro + Neon** | §4.4.5 | **$45～60** | 已建模；$20 抵扣后仍有 CPU 超额 |
| **CF Workers Paid + Neon** | 32M poll/月；含 10M 请求后 ~$6.6 + $5 底座 | **$30～45** | **出站流量不计费**；需 OpenNext 适配 |
| **Render** | Web Standard $25 + Ops Starter $7 + PG Basic-1gb $19 + 5GB 存 | **$55～65** | **与 poll 次数几乎无关**（CPU 够用时） |
| **Railway** | Web+Ops+PG 用量 | **$35～70** | Monorepo 多服务；波动大 |
| **Fly.io** | 2× shared-cpu-1x + 1GB PG 卷 + IPv4 | **$25～40** | 需 Dockerfile；AMS 区 |
| **Hetzner CX22 + Coolify** | €4.15 单机跑 web+ops+PG | **€5～12（~$6～13）** | 4GB 紧张；备份另计 |

### 3.2 约 100 家活跃店

| 方案 | 粗算月费 | 相对 Vercel 的要点 |
|------|----------|-------------------|
| **Vercel + Neon** | **$140～180** | 108M 次 poll/月 → 调用 + CPU 明显 |
| **CF Workers + Neon** | **$70～110** | 请求 ~$34 + Neon $40～80；**流量仍免费** |
| **Render** | **$90～130** | Web 可能升到 Standard/Pro；PG Basic-4gb；仍较可预测 |
| **Railway** | **$80～150** | 用量型，高峰更贵 |
| **Fly.io** | **$60～100** | 出口 $0.02/GB 有利 |
| **Hetzner CX32/CX42** | **€10～20（~$11～22）** | 需监控 CPU/RAM；**性价比极高** |

### 3.3 关键结论（性价比）

```text
最便宜（愿自运维）     → Hetzner + Coolify
Serverless 里最省钱   → Cloudflare Workers + Neon（若 OpenNext 验收通过）
最可预测、少踩坑       → Render（长驻进程，还可改 NOTIFY+SSE 去掉轮询税）
现状迁移成本最低       → 继续 Vercel + Neon（≤30 店仍合理）
```

---

## 4. 分平台说明（与 Mesa 相关细节）

### 4.1 Vercel + Neon（现状增强）

**优点**：Next.js 原生；双项目、Cron、`ignoreCommand` 已配置；团队零学习成本。  
**缺点**：Serverless **按次计费**，轻量轮询在 50 店以上贵；无长连接 `LISTEN` / 原生 WebSocket。  
**适合**：已上线、店数 **&lt;40**、优先 **快迁 Postgres** 而非迁平台。

---

### 4.2 Cloudflare Workers + Neon（Serverless 性价比候选）

**架构**：`@opennextjs/cloudflare` 部署 Next.js；Postgres 经 **Hyperdrive** 连接池（Paid 计划查询不限，见 [Hyperdrive 定价](https://developers.cloudflare.com/hyperdrive/platform/pricing/)）。

**优点**：

- Workers Paid **$5/月** 含 **1000 万请求**；超出 **$0.30/百万** → 100 店 poll 约 **$34/月** 量级（§3.2）
- **无出站流量费**（对轮询/json 友好）
- 欧盟节点多；DDoS 自带

**缺点 / 风险**：

- 非 Vercel 官方路径；`@mesa/shared`、Node API、部分依赖需 **兼容性清单**
- 函数 **128MB**、CPU 时间计费；重 SQL 的 board API 要压测
- Cron 改 Workers Cron；双应用 = 两个 Worker 或路由拆分
- Hyperdrive **缓存**对强一致厨房单不利 → poll/board 接口应 **禁用缓存**

**适合**：店数目标 **50～200**、愿花 **1～2 周** 做 OpenNext 验收。

---

### 4.3 Render（固定月费 PaaS）

**架构**：`apps/web`、`apps/ops` 各一个 **Web Service**（Docker 或 `npm start`）；**Render Postgres** 同区域私有网；Cron 用 **Cron Job** 服务。

**优点**：

- **长驻进程** → 可直接 **Postgres LISTEN + SSE**，SaaS 也可不做轮询（与私有化同代码路径）
- 价格 **按实例档位**，poll 百万次不单独计费（直到 CPU 打满）
- **法兰克福** 等区域；托管 PG、备份、PITR 档位可选
- 心智模型接近 Heroku，比 Fly 简单

**缺点**：

- 同配置通常 **高于** CF Workers 的纯请求计费；低于 Vercel 百店 poll
- Starter $7 仅 512MB，生产建议 Web **Standard $25** 起
- Monorepo 需两个 Service 手动配（无 Vercel 式 `ignoreCommand` 那么细，可用路径过滤 CI）

**粗配（30 店生产）**：Web $25 + Ops $7 + PG $19 + 存储 ≈ **$55～65/月**。

**适合**：想要 **可预测账单** + **SSE 统一实时** + 不想自管 VPS。

---

### 4.4 Railway

**优点**：Git 推送部署；**Monorepo 多服务**体验好；用量随规模平滑。  
**缺点**：账单波动；Postgres 高级特性弱于 Render/Neon； egress **$0.05/GB**。  
**适合**：小团队快速试生产；与 Vercel 类似的「少运维」但愿意接受账单浮动。

---

### 4.5 Fly.io

**优点**：**欧盟 AMS** 近葡萄牙；出口 **$0.02/GB**；VM 长驻可 SSE；规模上来常比 Render 便宜。  
**缺点**：CLI + `fly.toml`；Postgres 多为 **自管卷**，DBA 责任更大。  
**适合**：有轻微 DevOps 能力、重视 **跨境流量成本**。

---

### 4.6 Hetzner + Coolify（自托管，长期最便宜）

**架构**：一台 **CX22/CX32**（德国/芬兰）装 [Coolify](https://coolify.io)；Docker 部署 web、ops、Postgres（或 PG 托管在 Neon 仅连库）。

**优点**：

- **€4～7/月** 含 **20TB** 流量 → 轮询再猛也几乎不另收费
- 长驻 Node → **NOTIFY + SSE**；与 [`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md) / Windows 私有化 **同一套 Compose 经验**
- 葡萄牙访问欧盟机房延迟可接受（通常 &lt;50ms 级到 DE/FI）

**缺点**：

- 备份、升级、安全补丁、HA **全是你们的活**
- 单机故障 = 全站（需快照 / 第二节点才缓解）
- 商业 SaaS 要处理 **GDPR、监控、on-call**

**规模建议**：

| 店数 | 机器 | 粗算 |
|------|------|------|
| &lt;50 | CX22 4GB | €4～6 + 备份 |
| 50～150 | CX32 8GB | €7～10 |
| 150+ | 拆库（Neon）+ 双机或更大规格 | €15～40+ |

**适合**：**成本极度敏感**、已有私有化交付团队、或 Vercel 账单持续超 **$100/月** 后再迁。

---

## 5. 与「实时轮询」的耦合（选型时易忽略）

| 平台类型 | 轮询税 | 更优实时方案 |
|----------|--------|----------------|
| **Serverless**（Vercel、CF Workers） | 每次 poll = 1 次计费请求 | 轻量 `/poll` 必选；或 Redis+SSE（又多一项服务） |
| **长驻**（Render、Fly、Hetzner） | 固定 CPU；poll 只耗 CPU | **LISTEN + SSE** 可与私有化 **共用一套代码**，长期更优 |

因此：**若确定 6 个月内 &gt;50 店**，值得优先考虑 **长驻 PaaS 或 Hetzner**，不单为了月费，还为 **去掉轮询架构**。

---

## 6. 推荐决策树（Mesa 2026）

```text
                    开始
                      │
         ┌────────────┴────────────┐
         │ 近期店数 &lt; 30，优先快迁？   │
         └────────────┬────────────┘
                   是 │ 否
                      ▼
            继续 Vercel + Neon          店数 30～100？
            + B 轻量轮询                      │
                      │              ┌────────┴────────┐
                      │           要最少运维？        要最低月费？
                      │              │                  │
                      │              ▼                  ▼
                      │         Render 或           Hetzner
                      │         Railway             + Coolify
                      │         （可上 SSE）         （+ Neon 外置 PG 可选）
                      │
                      └──── 店数 50～200 且愿做适配？
                                    │
                                    ▼
                          Cloudflare Workers + Neon
                          （验证 OpenNext 后）
```

### 6.1 分阶段建议（可与 Postgres 迁移绑定）

| 阶段 | 店数 | 建议栈 |
|------|------|--------|
| **M1** Postgres 迁移上线 | 0～30 | **维持 Vercel + Neon** + B 轻量轮询 |
| **M2** 账单或延迟成为问题 | 30～80 | 评估 **Render**（SSE）或 **CF Workers**（压测后） |
| **M3** 规模化 | 80+ | **Render/Fly 长驻 SSE** 或 **Hetzner**；Vercel 百店 poll 通常不划算 |

---

## 7. 迁移工作量粗估（相对「只迁数据库」）

| 目标平台 | 额外工程 | 人周（粗估） |
|----------|----------|--------------|
| 维持 Vercel | 0（仅 Postgres 迁移） | 0 |
| Render / Railway / Fly | Dockerfile、`standalone` 输出、Cron、双服务、环境变量 | 1～2 |
| Cloudflare Workers | OpenNext、Hyperdrive、兼容矩阵、Cron | 2～3 |
| Hetzner + Coolify | Compose、反代、SSL、备份、监控 | 2～4（首台） |

**不建议** Postgres 迁移与换云 **同一维护窗口**；先 DB 再平台。

---

## 8. 综合推荐（给 Mesa 的结论）

1. **短期（迁移 Postgres）**：**不要同时换云**；继续 **Vercel Pro + Neon**，用 §4.4 的 **B 轻量轮询**，控制 30 店内月费约 **$45～60**。
2. **中期性价比（30～100 店、少自运维）**：**Render（法兰克福）** — 固定 **~$55～130/月**，并可把实时改成 **SSE**，从根上避免轮询税；与产品「私有化也用长驻 Next」一致。
3. **中期性价比（偏技术、请求量大）**：**Cloudflare Workers + Neon** — 百店可比 Vercel **省约 40～50% 计算侧**；需专门 spike 验证 Next.js 14 全功能。
4. **长期底价（愿运维）**：**Hetzner + Coolify** — 百店仍可能 **&lt;€20/月** 计算+库（单机）；适合与 **Windows 私有化** 共用 Docker 知识，但不替代客户现场安装支持流程。
5. **不推荐**：仅为省钱上 **笨轮询**；店数一多 **Vercel / 任何按次计费** 都会痛。

---

## 9. 下一步（若进入验证）

- [ ] 在 `stage` 用 **Render** 或 **CF Workers** 部署只读分支，跑厨房/下单 E2E  
- [ ] 对比同一脚本 30 店等效 poll 的 **账单模拟**（Vercel 仪表盘 vs 固定价）  
- [ ] 若选 Render/Fly/Hetzner：在迁移文档阶段 4 增加 **SSE 为 SaaS 默认**，轮询仅作降级  

---

## 附录：参考链接

- [Vercel Pro 计划](https://vercel.com/docs/plans/pro-plan)
- [Vercel vs Cloudflare（官方）](https://vercel.com/kb/guide/next-js-on-vercel-vs-cloudflare)
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare)
- [Render Postgres 灵活计划](https://render.com/docs/postgresql-refresh)
- [Railway 文档](https://docs.railway.com/)
- [Fly.io 定价](https://fly.io/docs/about/pricing/)
